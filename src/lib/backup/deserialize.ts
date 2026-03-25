import { prisma } from "@/lib/db";
import matter from "gray-matter";
import { hash } from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RestoreFile {
  path: string;
  content: string | Buffer;
}

export interface RestoreOptions {
  mode: "full" | "selective";
  selectedProjects?: string[];
}

export interface RestoreResult {
  usersCreated: number;
  projectsRestored: number;
  designsRestored: number;
}

interface UserJson {
  id: string;
  username: string;
  email?: string | null;
  name?: string | null;
  createdAt?: string;
}

interface ProjectJson {
  id: string;
  name: string;
  description?: string | null;
  ownerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  shareLinks?: ShareLinkJson[];
}

interface ShareLinkJson {
  id: string;
  token: string;
  folderId?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
}

interface FolderJson {
  id: string;
  name: string;
  parentId?: string | null;
  order?: number;
}

interface CommentJson {
  id: string;
  pinNumber: number;
  content: string;
  authorName: string;
  authorId?: string | null;
  resolved?: boolean;
  discarded?: boolean;
  version?: number | null;
  xPercent?: number | null;
  yPercent?: number | null;
  anchorText?: string | null;
  anchorLine?: number | null;
  anchorHeading?: string | null;
  anchorContext?: string | null;
  contextBefore?: string | null;
  contextAfter?: string | null;
  createdAt?: string;
  replies?: ReplyJson[];
}

interface ReplyJson {
  id: string;
  content: string;
  authorName: string;
  authorId?: string | null;
  createdAt?: string;
}

interface VersionJson {
  version: number;
  changeNote?: string | null;
  createdAt?: string;
}

interface ImageSidecar {
  id: string;
  name: string;
  status?: string;
  currentVersion?: number;
  filePath?: string | null;
  order?: number;
  createdAt?: string;
  updatedAt?: string;
  versions?: VersionJson[];
  comments?: CommentJson[];
}

interface TreeEntry {
  path: string;
  type: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findFile(
  files: RestoreFile[],
  filePath: string,
): RestoreFile | undefined {
  return files.find((f) => f.path === filePath);
}

function textContent(file: RestoreFile): string {
  if (typeof file.content === "string") return file.content;
  return file.content.toString("utf-8");
}

function parseJson<T>(file: RestoreFile): T {
  return JSON.parse(textContent(file)) as T;
}

/** Check if a path is under a given directory */
function isUnderDir(filePath: string, dir: string): boolean {
  const normalized = dir.endsWith("/") ? dir : dir + "/";
  return filePath.startsWith(normalized) || filePath === dir;
}

// ---------------------------------------------------------------------------
// parseProjectsFromTree — preview helper
// ---------------------------------------------------------------------------

export function parseProjectsFromTree(
  tree: TreeEntry[],
): Array<{ path: string; owner: string; name: string }> {
  const results: Array<{ path: string; owner: string; name: string }> = [];

  for (const entry of tree) {
    if (!entry.path.endsWith("/_project.json")) continue;

    // The project directory is the parent of _project.json
    const projectDir = entry.path.replace(/\/_project\.json$/, "");
    const parts = projectDir.split("/");

    if (parts.length < 2) continue;

    const owner = parts[0];
    const name = parts.slice(1).join("/");

    results.push({ path: projectDir, owner, name });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main deserializer
// ---------------------------------------------------------------------------

export async function deserializeBackup(
  files: RestoreFile[],
  options: RestoreOptions,
): Promise<RestoreResult> {
  const result: RestoreResult = {
    usersCreated: 0,
    projectsRestored: 0,
    designsRestored: 0,
  };

  // ---- Full mode: wipe DB in dependency order ------------------------------

  if (options.mode === "full") {
    await prisma.reply.deleteMany();
    await prisma.comment.deleteMany();
    await prisma.designVersion.deleteMany();
    await prisma.design.deleteMany();
    await prisma.shareLink.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.project.deleteMany();
    await prisma.user.deleteMany();
  }

  // ---- Restore users from _users.json ------------------------------------

  const userIdMap = new Map<string, string>(); // old ID → new ID

  const usersFile = findFile(files, "_users.json");
  if (usersFile) {
    const usersData = parseJson<UserJson[]>(usersFile);
    const defaultPasswordHash = await hash("changeme", 10);

    for (const u of usersData) {
      // Check if username already exists (deduplication)
      const existing = await prisma.user.findUnique({
        where: { username: u.username },
      });

      if (existing) {
        userIdMap.set(u.id, existing.id);
      } else {
        const newUser = await prisma.user.create({
          data: {
            username: u.username,
            email: u.email ?? null,
            name: u.name ?? null,
            passwordHash: defaultPasswordHash,
          },
        });
        userIdMap.set(u.id, newUser.id);
        result.usersCreated++;
      }
    }
  }

  // ---- Find all _project.json files --------------------------------------

  const projectFiles = files.filter((f) => f.path.endsWith("/_project.json"));

  for (const projectFile of projectFiles) {
    const projectDir = projectFile.path.replace(/\/_project\.json$/, "");

    // In selective mode, skip if not selected
    if (
      options.mode === "selective" &&
      options.selectedProjects &&
      !options.selectedProjects.includes(projectDir)
    ) {
      continue;
    }

    const projectMeta = parseJson<ProjectJson>(projectFile);

    // Remap ownerId
    const newOwnerId = projectMeta.ownerId
      ? userIdMap.get(projectMeta.ownerId) ?? null
      : null;

    const newProject = await prisma.project.create({
      data: {
        name: projectMeta.name,
        description: projectMeta.description ?? null,
        ownerId: newOwnerId,
      },
    });

    result.projectsRestored++;

    // ---- Restore share links ---------------------------------------------

    if (projectMeta.shareLinks) {
      for (const sl of projectMeta.shareLinks) {
        // We'll remap folderId after folders are created; store for later
        // For now create share links without folderId
        await prisma.shareLink.create({
          data: {
            projectId: newProject.id,
            token: sl.token,
            folderId: null, // will be updated after folder creation
            expiresAt: sl.expiresAt ? new Date(sl.expiresAt) : null,
          },
        });
      }
    }

    // ---- Find all _folder.json files under this project ------------------

    const folderFiles = files.filter(
      (f) =>
        isUnderDir(f.path, projectDir) && f.path.endsWith("/_folder.json"),
    );

    const folderIdMap = new Map<string, string>(); // old folder ID → new folder ID
    const folderMetas: Array<{ meta: FolderJson; newId: string }> = [];

    // Pass 1: Create all folders without parent relationships
    for (const folderFile of folderFiles) {
      const folderMeta = parseJson<FolderJson>(folderFile);

      const newFolder = await prisma.folder.create({
        data: {
          name: folderMeta.name,
          projectId: newProject.id,
          parentId: null,
          order: folderMeta.order ?? 0,
        },
      });

      folderIdMap.set(folderMeta.id, newFolder.id);
      folderMetas.push({ meta: folderMeta, newId: newFolder.id });
    }

    // Pass 2: Set parentId relationships
    for (const { meta, newId } of folderMetas) {
      if (meta.parentId) {
        const newParentId = folderIdMap.get(meta.parentId);
        if (newParentId) {
          await prisma.folder.update({
            where: { id: newId },
            data: { parentId: newParentId },
          });
        }
      }
    }

    // ---- Update share link folderIds now that folders exist ---------------

    if (projectMeta.shareLinks) {
      for (const sl of projectMeta.shareLinks) {
        if (sl.folderId) {
          const newFolderId = folderIdMap.get(sl.folderId);
          if (newFolderId) {
            await prisma.shareLink.updateMany({
              where: { token: sl.token },
              data: { folderId: newFolderId },
            });
          }
        }
      }
    }

    // ---- Process design files --------------------------------------------

    // Collect folder directories and their new IDs
    const folderDirToId = new Map<string, string>();
    for (const folderFile of folderFiles) {
      const folderDir = folderFile.path.replace(/\/_folder\.json$/, "");
      const folderMeta = parseJson<FolderJson>(folderFile);
      const newFolderId = folderIdMap.get(folderMeta.id);
      if (newFolderId) {
        folderDirToId.set(folderDir, newFolderId);
      }
    }

    // Find design files (markdown and image sidecars) under this project
    const projectDesignFiles = files.filter((f) => {
      if (!isUnderDir(f.path, projectDir)) return false;
      // Skip metadata files and version files
      const basename = f.path.split("/").pop() ?? "";
      if (basename.startsWith("_")) return false;
      if (f.path.includes("/_versions/")) return false;
      // Match .md files or .meta.json files
      return basename.endsWith(".md") || basename.endsWith(".meta.json");
    });

    for (const designFile of projectDesignFiles) {
      const designDir = designFile.path.substring(
        0,
        designFile.path.lastIndexOf("/"),
      );

      // Find the containing folder
      const newFolderId = folderDirToId.get(designDir);
      if (!newFolderId) continue;

      if (designFile.path.endsWith(".md")) {
        // ---- Markdown design ----
        await restoreMarkdownDesign(
          designFile,
          newFolderId,
          designDir,
          files,
          userIdMap,
        );
        result.designsRestored++;
      } else if (designFile.path.endsWith(".meta.json")) {
        // ---- Image design ----
        await restoreImageDesign(
          designFile,
          newFolderId,
          designDir,
          files,
          userIdMap,
        );
        result.designsRestored++;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Markdown design restoration
// ---------------------------------------------------------------------------

async function restoreMarkdownDesign(
  file: RestoreFile,
  folderId: string,
  folderDir: string,
  allFiles: RestoreFile[],
  userIdMap: Map<string, string>,
): Promise<void> {
  const raw = textContent(file);
  const parsed = matter(raw);

  const frontmatter = parsed.data as {
    id?: string;
    status?: string;
    currentVersion?: number;
    order?: number;
    createdAt?: string;
    updatedAt?: string;
    versions?: VersionJson[];
    comments?: CommentJson[];
  };

  const body = parsed.content;
  const designName =
    file.path.split("/").pop()?.replace(/\.md$/, "") ?? "Untitled";

  const newDesign = await prisma.design.create({
    data: {
      name: designName,
      type: "MARKDOWN",
      status: frontmatter.status ?? "DRAFT",
      content: body,
      currentVersion: frontmatter.currentVersion ?? 1,
      folderId,
      order: frontmatter.order ?? 0,
    },
  });

  // ---- Create DesignVersion records ----

  if (frontmatter.versions) {
    for (const v of frontmatter.versions) {
      let versionContent: string | null = null;

      if (v.version === frontmatter.currentVersion) {
        // Current version content is the body
        versionContent = body;
      } else {
        // Try to find old version content in _versions/
        const fileName = file.path.split("/").pop() ?? "";
        const versionPath = `${folderDir}/_versions/${fileName}.v${v.version}.md`;
        const versionFile = allFiles.find((f) => f.path === versionPath);
        if (versionFile) {
          versionContent = textContent(versionFile);
        }
      }

      await prisma.designVersion.create({
        data: {
          designId: newDesign.id,
          version: v.version,
          content: versionContent,
          changeNote: v.changeNote ?? null,
        },
      });
    }
  }

  // ---- Create Comment and Reply records ----

  if (frontmatter.comments) {
    await restoreComments(frontmatter.comments, newDesign.id, userIdMap);
  }
}

// ---------------------------------------------------------------------------
// Image design restoration
// ---------------------------------------------------------------------------

async function restoreImageDesign(
  sidecarFile: RestoreFile,
  folderId: string,
  folderDir: string,
  allFiles: RestoreFile[],
  userIdMap: Map<string, string>,
): Promise<void> {
  const sidecar = parseJson<ImageSidecar>(sidecarFile);

  // Find the corresponding image binary file
  // The sidecar is named like "image.meta.json", the image is "image.png"
  // We need to determine the image path from the sidecar path
  const sidecarPath = sidecarFile.path;
  const sidecarBaseName = sidecarPath.replace(/\.meta\.json$/, "");

  // Try to find the image binary in the file tree
  const imageFile = allFiles.find(
    (f) =>
      f.path.startsWith(sidecarBaseName) &&
      !f.path.endsWith(".meta.json") &&
      !f.path.includes("/_versions/") &&
      !f.path.endsWith("/_folder.json") &&
      !f.path.endsWith("/_project.json"),
  );

  let savedFilePath: string | null = null;

  if (imageFile) {
    // Save image to uploads/ with UUID filename
    const ext = path.extname(imageFile.path) || ".png";
    const newFileName = uuidv4() + ext;
    const uploadsDir = path.join(process.cwd(), "uploads");

    await mkdir(uploadsDir, { recursive: true });
    await writeFile(
      path.join(uploadsDir, newFileName),
      imageFile.content as Buffer,
    );
    savedFilePath = newFileName;
  }

  const newDesign = await prisma.design.create({
    data: {
      name: sidecar.name,
      type: "IMAGE",
      status: sidecar.status ?? "DRAFT",
      filePath: savedFilePath,
      currentVersion: sidecar.currentVersion ?? 1,
      folderId,
      order: sidecar.order ?? 0,
    },
  });

  // ---- Create DesignVersion records ----

  if (sidecar.versions) {
    for (const v of sidecar.versions) {
      let versionFilePath: string | null = null;

      if (v.version === sidecar.currentVersion) {
        versionFilePath = savedFilePath;
      } else {
        // Try to find old version image in _versions/
        const baseName = sidecarBaseName.split("/").pop() ?? "";
        const ext = path.extname(sidecar.filePath ?? ".png") || ".png";
        const versionImagePath = `${folderDir}/_versions/${baseName}.v${v.version}${ext}`;
        const versionFile = allFiles.find((f) => f.path === versionImagePath);

        if (versionFile) {
          const vFileName = uuidv4() + ext;
          const uploadsDir = path.join(process.cwd(), "uploads");
          await mkdir(uploadsDir, { recursive: true });
          await writeFile(
            path.join(uploadsDir, vFileName),
            versionFile.content as Buffer,
          );
          versionFilePath = vFileName;
        }
      }

      await prisma.designVersion.create({
        data: {
          designId: newDesign.id,
          version: v.version,
          filePath: versionFilePath,
          changeNote: v.changeNote ?? null,
        },
      });
    }
  }

  // ---- Create Comment and Reply records ----

  if (sidecar.comments) {
    await restoreComments(sidecar.comments, newDesign.id, userIdMap);
  }
}

// ---------------------------------------------------------------------------
// Comment + Reply restoration
// ---------------------------------------------------------------------------

async function restoreComments(
  comments: CommentJson[],
  designId: string,
  userIdMap: Map<string, string>,
): Promise<void> {
  for (const c of comments) {
    // Remap authorId
    const newAuthorId = c.authorId
      ? userIdMap.get(c.authorId) ?? null
      : null;

    const newComment = await prisma.comment.create({
      data: {
        designId,
        pinNumber: c.pinNumber,
        content: c.content,
        authorName: c.authorName,
        authorId: newAuthorId,
        resolved: c.resolved ?? false,
        discarded: c.discarded ?? false,
        version: c.version ?? null,
        xPercent: c.xPercent ?? null,
        yPercent: c.yPercent ?? null,
        anchorText: c.anchorText ?? null,
        anchorLine: c.anchorLine ?? null,
        anchorHeading: c.anchorHeading ?? null,
        anchorContext: c.anchorContext ?? null,
        contextBefore: c.contextBefore ?? null,
        contextAfter: c.contextAfter ?? null,
      },
    });

    // Create replies
    if (c.replies) {
      for (const r of c.replies) {
        const replyAuthorId = r.authorId
          ? userIdMap.get(r.authorId) ?? null
          : null;

        await prisma.reply.create({
          data: {
            commentId: newComment.id,
            content: r.content,
            authorName: r.authorName,
            authorId: replyAuthorId,
          },
        });
      }
    }
  }
}
