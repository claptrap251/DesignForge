import { prisma } from "@/lib/db";

/**
 * Walk up the folder tree to find the ownerUsername of the root user folder.
 * Returns the username if found, null otherwise.
 */
export async function getOwnerUsername(folderId: string): Promise<string | null> {
  let currentId: string | null = folderId;

  while (currentId) {
    const folder: { ownerUsername: string | null; parentId: string | null } | null =
      await prisma.folder.findUnique({
        where: { id: currentId },
        select: { ownerUsername: true, parentId: true },
      });
    if (!folder) return null;
    if (folder.ownerUsername) return folder.ownerUsername;
    currentId = folder.parentId;
  }

  return null;
}

/**
 * Check if the given username owns the specified folder.
 */
export async function isOwnerOfFolder(folderId: string, username: string): Promise<boolean> {
  const owner = await getOwnerUsername(folderId);
  return owner === username;
}

/**
 * Check if the given username owns the specified design.
 */
export async function isOwnerOfDesign(designId: string, username: string): Promise<boolean> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    select: { folderId: true },
  });
  if (!design) return false;
  return isOwnerOfFolder(design.folderId, username);
}
