import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "./github";

interface ScrapeResult {
  status: "success" | "partial" | "failed";
  filesFound: number;
  filesCreated: number;
  filesUpdated: number;
  reposScraped: number;
  reposSkipped: number;
  error?: string;
}

async function ensureFolder(
  projectId: string,
  parentId: string | null,
  name: string
): Promise<string> {
  const existing = await prisma.folder.findFirst({
    where: { projectId, parentId, name },
  });
  if (existing) return existing.id;

  const maxOrder = await prisma.folder.aggregate({
    where: { projectId, parentId },
    _max: { order: true },
  });

  const folder = await prisma.folder.create({
    data: {
      name,
      projectId,
      parentId,
      ownerUsername: null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return folder.id;
}

async function upsertDesign(
  folderId: string,
  name: string,
  content: string
): Promise<"created" | "updated"> {
  const existing = await prisma.design.findFirst({
    where: { folderId, name },
  });

  if (existing) {
    await prisma.design.update({
      where: { id: existing.id },
      data: { content },
    });
    return "updated";
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  await prisma.design.create({
    data: {
      name,
      type: "MARKDOWN",
      status: "DRAFT",
      content,
      folderId,
      currentVersion: 1,
      order: (maxOrder._max.order ?? -1) + 1,
      versions: { create: { version: 1, content } },
    },
  });
  return "created";
}

function stripMdExtension(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, "");
}

export async function runScrape(
  targetId: string,
  trigger: "auto" | "manual" = "manual"
): Promise<ScrapeResult> {
  const target = await prisma.scrapeTarget.findUnique({
    where: { id: targetId },
    include: { repos: { where: { enabled: true } } },
  });

  if (!target) throw new Error(`Scrape target ${targetId} not found`);

  const run = await prisma.scrapeRun.create({
    data: { targetId, trigger, status: "running" },
  });

  const result: ScrapeResult = {
    status: "success",
    filesFound: 0,
    filesCreated: 0,
    filesUpdated: 0,
    reposScraped: 0,
    reposSkipped: 0,
  };

  const log: string[] = [];
  const indexData: Map<string, string[]> = new Map();

  try {
    const token = decrypt(target.encryptedToken);
    const scraper = new GitHubScraper(target.apiUrl, token);

    const scrapedataId = await ensureFolder(target.projectId, null, "scrapedata");

    for (const repo of target.repos) {
      const [owner, repoName] = repo.repoFullName.split("/");

      try {
        let sha = await scraper.getBranchSha(owner, repoName, repo.branch);
        if (!sha && repo.branch !== repo.defaultBranch) {
          log.push(`[${repo.repoFullName}] Branch "${repo.branch}" not found, falling back to "${repo.defaultBranch}"`);
          sha = await scraper.getBranchSha(owner, repoName, repo.defaultBranch);
        }
        if (!sha) {
          log.push(`[${repo.repoFullName}] No valid branch found, skipping`);
          result.reposSkipped++;
          continue;
        }

        const tree = await scraper.getTreeRecursive(owner, repoName, sha);
        const mdFiles = tree.filter((e) => e.type === "blob" && e.path.endsWith(".md"));
        result.filesFound += mdFiles.length;

        if (mdFiles.length === 0) {
          log.push(`[${repo.repoFullName}] No markdown files found, skipping`);
          result.reposSkipped++;
          continue;
        }

        const repoFolderId = await ensureFolder(target.projectId, scrapedataId, repoName);
        const filePaths: string[] = [];

        for (const file of mdFiles) {
          const content = await scraper.getBlobContent(owner, repoName, file.sha);
          const parts = file.path.split("/");
          const filename = parts.pop()!;
          const designName = stripMdExtension(filename);

          let currentFolderId = repoFolderId;
          for (const dir of parts) {
            currentFolderId = await ensureFolder(target.projectId, currentFolderId, dir);
          }

          const action = await upsertDesign(currentFolderId, designName, content);
          if (action === "created") result.filesCreated++;
          else result.filesUpdated++;

          filePaths.push(file.path);
        }

        indexData.set(repoName, filePaths);
        result.reposScraped++;
        log.push(`[${repo.repoFullName}] Scraped ${mdFiles.length} files`);
      } catch (err: unknown) {
        log.push(`[${repo.repoFullName}] Error: ${err instanceof Error ? err.message : String(err)}`);
        result.reposSkipped++;
      }
    }

    // Generate index
    const totalFiles = Array.from(indexData.values()).reduce((sum, f) => sum + f.length, 0);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    let indexContent = `# Scraped Markdown Index\n\n> Last synced ${now} | Source: ${target.githubName} | ${indexData.size} repos, ${totalFiles} files\n\n`;
    for (const [repoName, files] of indexData) {
      indexContent += `${repoName}: ${files.join(", ")}\n`;
    }
    await upsertDesign(scrapedataId, "Index", indexContent.trimEnd());

    if (result.reposSkipped > 0 && result.reposScraped > 0) {
      result.status = "partial";
    } else if (result.reposScraped === 0 && target.repos.length > 0) {
      result.status = "failed";
    }
  } catch (err: unknown) {
    result.status = "failed";
    result.error = err instanceof Error ? err.message : String(err);
    log.push(`Fatal error: ${result.error}`);
  }

  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      status: result.status,
      filesFound: result.filesFound,
      filesCreated: result.filesCreated,
      filesUpdated: result.filesUpdated,
      reposScraped: result.reposScraped,
      reposSkipped: result.reposSkipped,
      error: result.error,
      log: JSON.stringify(log),
      completedAt: new Date(),
    },
  });

  return result;
}
