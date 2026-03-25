import { describe, it, expect, beforeEach } from "vitest";
import { prisma, cleanDb, createTestUser, createTestProject, createTestFolder, createTestMarkdownDesign } from "./helpers";

describe("Backup Serialization - Data Layer", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should query all data needed for backup", async () => {
    const user = await createTestUser({ username: "alice" });
    const project = await prisma.project.create({
      data: { name: "My Project", ownerId: user.id },
    });
    const folder = await createTestFolder(project.id, "Wireframes");
    const design = await createTestMarkdownDesign(folder.id, "# Hello");
    await prisma.comment.create({
      data: { designId: design.id, pinNumber: 1, content: "Nice work", authorName: "alice", anchorLine: 1 },
    });

    const fullProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: {
        owner: true,
        folders: {
          include: {
            designs: {
              include: { comments: { include: { replies: true } }, versions: true },
            },
          },
        },
        shareLinks: true,
      },
    });

    expect(fullProject).not.toBeNull();
    expect(fullProject!.owner!.username).toBe("alice");
    expect(fullProject!.folders).toHaveLength(1);
    expect(fullProject!.folders[0].designs).toHaveLength(1);
    expect(fullProject!.folders[0].designs[0].comments).toHaveLength(1);
    expect(fullProject!.folders[0].designs[0].versions).toHaveLength(1);
  });

  it("should handle projects with nested folders", async () => {
    const project = await createTestProject();
    const parent = await createTestFolder(project.id, "Parent");
    const child = await prisma.folder.create({
      data: { name: "Child", projectId: project.id, parentId: parent.id, order: 0 },
    });

    const folders = await prisma.folder.findMany({
      where: { projectId: project.id },
      orderBy: { order: "asc" },
    });

    expect(folders).toHaveLength(2);
    const childFolder = folders.find((f) => f.id === child.id);
    expect(childFolder!.parentId).toBe(parent.id);
  });
});
