import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "@/lib/scraper/github";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { targetId } = body;

  const target = await prisma.scrapeTarget.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const token = decrypt(target.encryptedToken);
  const scraper = new GitHubScraper(target.apiUrl, token);

  const repos = [];
  for await (const page of scraper.listRepos(target.githubType as "org" | "user", target.githubName)) {
    repos.push(...page);
  }

  const reposWithCounts = [];
  for (const repo of repos) {
    const [owner, repoName] = repo.fullName.split("/");
    try {
      const sha = await scraper.getBranchSha(owner, repoName, repo.defaultBranch);
      let mdCount = 0;
      if (sha) {
        const tree = await scraper.getTreeRecursive(owner, repoName, sha);
        mdCount = tree.filter((e) => e.type === "blob" && e.path.endsWith(".md")).length;
      }
      reposWithCounts.push({ ...repo, mdFileCount: mdCount });
    } catch {
      reposWithCounts.push({ ...repo, mdFileCount: 0 });
    }
  }

  return NextResponse.json(reposWithCounts);
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { targetId, repos } = body;

  if (!targetId || !Array.isArray(repos)) {
    return NextResponse.json({ error: "targetId and repos array required" }, { status: 400 });
  }

  await prisma.scrapeRepo.deleteMany({ where: { targetId } });

  for (const repo of repos) {
    await prisma.scrapeRepo.create({
      data: {
        targetId,
        repoFullName: repo.repoFullName,
        branch: repo.branch,
        defaultBranch: repo.defaultBranch,
        enabled: repo.enabled,
      },
    });
  }

  return NextResponse.json({ success: true, count: repos.length });
}
