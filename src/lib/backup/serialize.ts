import { prisma } from "@/lib/db";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import matter from "gray-matter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BackupFile {
  path: string;
  content: string;
  binary?: false;
}

interface BackupBinaryFile {
  path: string;
  content: Buffer;
  binary: true;
}

export type BackupFileEntry = BackupFile | BackupBinaryFile;

interface DesignIndexEntry {
  path: string;
  hash: string;
  type: string;
}

interface BackupStats {
  users: number;
  projects: number;
  folders: number;
  designs: number;
  comments: number;
  versions: number;
}

interface ManifestRelationship {
  projectId: string;
  ownerId: string | null;
  folderIds: string[];
  designIds: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove filesystem-unsafe characters from a name */
export function sanitizeName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .replace(/\.+$/g, "")
    .trim() || "unnamed";
}

/** Append -2, -3, etc. if `basePath` already appears in `usedPaths` */
export function deduplicatePath(
  usedPaths: Set<string>,
  basePath: string,
): string {
  if (!usedPaths.has(basePath)) {
    usedPaths.add(basePath);
    return basePath;
  }
  let counter = 2;
  while (usedPaths.has(`${basePath}-${counter}`)) counter++;
  const deduped = `${basePath}-${counter}`;
  usedPaths.add(deduped);
  return deduped;
}

/** SHA-256 content hash with "sha256:" prefix */
export function contentHash(content: string | Buffer): string {
  const hash = createHash("sha256")
    .update(content)
    .digest("hex");
  return `sha256:${hash}`;
}

// ---------------------------------------------------------------------------
// Folder path builder (resolves parent chain for nested folders)
// ---------------------------------------------------------------------------

function buildFolderPathMap(
  folders: Array<{ id: string; name: string; parentId: string | null }>,
): Map<string, string> {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const cache = new Map<string, string>();

  function resolve(id: string): string {
    if (cache.has(id)) return cache.get(id)!;
    const folder = byId.get(id);
    if (!folder) return "unknown";
    const segment = sanitizeName(folder.name);
    const full = folder.parentId
      ? `${resolve(folder.parentId)}/${segment}`
      : segment;
    cache.set(id, full);
    return full;
  }

  for (const f of folders) resolve(f.id);
  return cache;
}

// ---------------------------------------------------------------------------
// Main serializer
// ---------------------------------------------------------------------------

export async function serializeBackup(): Promise<{
  files: BackupFileEntry[];
  stats: BackupStats;
}> {
  const files: BackupFileEntry[] = [];
  const usedPaths = new Set<string>();
  const designIndex: Record<string, DesignIndexEntry> = {};
  const contentHashes: Record<string, string[]> = {};

  const stats: BackupStats = {
    users: 0,
    projects: 0,
    folders: 0,
    designs: 0,
    comments: 0,
    versions: 0,
  };

  // ---- Load all data -------------------------------------------------------

  const users = await prisma.user.findMany();
  stats.users = users.length;

  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      folders: {
        include: {
          designs: {
            include: {
              comments: { include: { replies: true } },
              versions: true,
            },
          },
        },
      },
      shareLinks: true,
    },
  });

  // ---- _users.json ---------------------------------------------------------

  const usersData = users.map((u) => ({
    id: u.id,
    username: u.username,
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  }));

  files.push({
    path: "_users.json",
    content: JSON.stringify(usersData, null, 2),
  });

  // ---- Per-project ---------------------------------------------------------

  const relationships: ManifestRelationship[] = [];

  for (const project of projects) {
    stats.projects++;

    const ownerName = project.owner
      ? sanitizeName(project.owner.username)
      : "_no_owner";
    const projectDir = deduplicatePath(
      usedPaths,
      `${ownerName}/${sanitizeName(project.name)}`,
    );

    // _project.json
    const projectMeta = {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      shareLinks: project.shareLinks.map((sl) => ({
        id: sl.id,
        token: sl.token,
        folderId: sl.folderId,
        expiresAt: sl.expiresAt?.toISOString() ?? null,
        createdAt: sl.createdAt.toISOString(),
      })),
    };

    files.push({
      path: `${projectDir}/_project.json`,
      content: JSON.stringify(projectMeta, null, 2),
    });

    // Build folder path map for this project
    const allFolders = project.folders;
    const folderPathMap = buildFolderPathMap(
      allFolders.map((f) => ({ id: f.id, name: f.name, parentId: f.parentId })),
    );

    const folderIds: string[] = [];
    const designIds: string[] = [];

    for (const folder of allFolders) {
      stats.folders++;
      folderIds.push(folder.id);

      const folderRelPath = folderPathMap.get(folder.id) ?? sanitizeName(folder.name);
      const folderDir = `${projectDir}/${folderRelPath}`;

      // _folder.json
      const folderMeta = {
        id: folder.id,
        name: folder.name,
        parentId: folder.parentId,
        order: folder.order,
      };

      files.push({
        path: `${folderDir}/_folder.json`,
        content: JSON.stringify(folderMeta, null, 2),
      });

      // ---- Designs in this folder ------------------------------------------

      for (const design of folder.designs) {
        stats.designs++;
        designIds.push(design.id);
        stats.comments += design.comments.length;
        stats.versions += design.versions.length;

        const commentsData = design.comments.map((c) => ({
          id: c.id,
          pinNumber: c.pinNumber,
          content: c.content,
          authorName: c.authorName,
          resolved: c.resolved,
          discarded: c.discarded,
          version: c.version,
          xPercent: c.xPercent,
          yPercent: c.yPercent,
          anchorText: c.anchorText,
          anchorLine: c.anchorLine,
          anchorHeading: c.anchorHeading,
          anchorContext: c.anchorContext,
          contextBefore: c.contextBefore,
          contextAfter: c.contextAfter,
          createdAt: c.createdAt.toISOString(),
          replies: c.replies.map((r) => ({
            id: r.id,
            content: r.content,
            authorName: r.authorName,
            createdAt: r.createdAt.toISOString(),
          })),
        }));

        const versionsData = design.versions.map((v) => ({
          version: v.version,
          changeNote: v.changeNote,
          createdAt: v.createdAt.toISOString(),
        }));

        if (design.type === "MARKDOWN") {
          // --- Markdown design → .md with YAML frontmatter ---
          const designFileName = sanitizeName(design.name).replace(/\.md$/i, "") + ".md";
          const designPath = deduplicatePath(
            usedPaths,
            `${folderDir}/${designFileName}`,
          );

          const frontmatter = {
            id: design.id,
            status: design.status,
            currentVersion: design.currentVersion,
            order: design.order,
            createdAt: design.createdAt.toISOString(),
            updatedAt: design.updatedAt.toISOString(),
            versions: versionsData,
            comments: commentsData,
          };

          const body = design.content ?? "";
          const fileContent = matter.stringify(body, frontmatter);
          const hash = contentHash(fileContent);

          files.push({ path: designPath, content: fileContent });

          designIndex[design.id] = { path: designPath, hash, type: "MARKDOWN" };
          (contentHashes[hash] ??= []).push(design.id);

          // Old versions → _versions/ subdirectory
          for (const v of design.versions) {
            if (v.version === design.currentVersion) continue;
            if (!v.content) continue;
            const versionPath = `${folderDir}/_versions/${designFileName}.v${v.version}.md`;
            files.push({ path: versionPath, content: v.content });
          }
        } else {
          // --- Image design → binary + sidecar .meta.json ---
          const ext = path.extname(design.filePath ?? ".png") || ".png";
          const baseName = sanitizeName(design.name).replace(
            new RegExp(`\\${ext}$`, "i"),
            "",
          );
          const imageFileName = baseName + ext;
          const imagePath = deduplicatePath(
            usedPaths,
            `${folderDir}/${imageFileName}`,
          );
          const metaPath = `${imagePath.replace(new RegExp(`\\${ext}$`), "")}.meta.json`;

          // Try to read binary from uploads/
          try {
            const uploadsDir = path.join(process.cwd(), "uploads");
            const imageBuffer = await readFile(
              path.join(uploadsDir, design.filePath!),
            );
            files.push({ path: imagePath, content: imageBuffer, binary: true });
          } catch {
            // Image file missing — skip binary but still write metadata
          }

          const sidecar = {
            id: design.id,
            name: design.name,
            status: design.status,
            currentVersion: design.currentVersion,
            filePath: design.filePath,
            order: design.order,
            createdAt: design.createdAt.toISOString(),
            updatedAt: design.updatedAt.toISOString(),
            versions: versionsData,
            comments: commentsData,
          };

          const metaContent = JSON.stringify(sidecar, null, 2);
          const hash = contentHash(metaContent);

          files.push({ path: metaPath, content: metaContent });

          designIndex[design.id] = { path: imagePath, hash, type: "IMAGE" };
          (contentHashes[hash] ??= []).push(design.id);

          // Old version images → _versions/
          for (const v of design.versions) {
            if (v.version === design.currentVersion) continue;
            if (!v.filePath) continue;
            try {
              const uploadsDir = path.join(process.cwd(), "uploads");
              const versionBuffer = await readFile(
                path.join(uploadsDir, v.filePath),
              );
              const versionPath = `${folderDir}/_versions/${baseName}.v${v.version}${ext}`;
              files.push({
                path: versionPath,
                content: versionBuffer,
                binary: true,
              });
            } catch {
              // Old version image missing — skip
            }
          }
        }
      }
    }

    relationships.push({
      projectId: project.id,
      ownerId: project.ownerId,
      folderIds,
      designIds,
    });
  }

  // ---- _manifest.json ------------------------------------------------------

  const manifest = {
    schemaVersion: 1,
    backupDate: new Date().toISOString(),
    stats,
    designIndex,
    contentHashes,
    relationships,
  };

  files.push({
    path: "_manifest.json",
    content: JSON.stringify(manifest, null, 2),
  });

  return { files, stats };
}
