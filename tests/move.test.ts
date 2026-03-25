import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestProject,
  createTestFolder,
  createTestMarkdownDesign,
} from "./helpers";

describe("Design Move - Single", () => {
  let projectId: string;
  let folderA: string;
  let folderB: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    const fA = await createTestFolder(projectId, "Folder A");
    const fB = await createTestFolder(projectId, "Folder B");
    folderA = fA.id;
    folderB = fB.id;
  });

  it("should move a design to a different folder in the same project", async () => {
    const design = await createTestMarkdownDesign(folderA);
    const updated = await prisma.design.update({
      where: { id: design.id },
      data: { folderId: folderB },
    });
    expect(updated.folderId).toBe(folderB);
    const sourceDesigns = await prisma.design.findMany({ where: { folderId: folderA } });
    expect(sourceDesigns).toHaveLength(0);
    const targetDesigns = await prisma.design.findMany({ where: { folderId: folderB } });
    expect(targetDesigns).toHaveLength(1);
  });

  it("should reject move to a folder in a different project", async () => {
    const otherProject = await prisma.project.create({ data: { name: "Other Project" } });
    const otherFolder = await createTestFolder(otherProject.id, "Other Folder");
    const design = await createTestMarkdownDesign(folderA);
    const designFolder = await prisma.folder.findUnique({ where: { id: design.folderId } });
    const targetFolder = await prisma.folder.findUnique({ where: { id: otherFolder.id } });
    expect(designFolder!.projectId).toBe(projectId);
    expect(targetFolder!.projectId).toBe(otherProject.id);
    expect(designFolder!.projectId).not.toBe(targetFolder!.projectId);
  });

  it("should preserve comments when moving a design", async () => {
    const design = await createTestMarkdownDesign(folderA);
    await prisma.comment.create({
      data: { designId: design.id, pinNumber: 1, content: "Test comment", authorName: "Alice", anchorLine: 1 },
    });
    await prisma.design.update({ where: { id: design.id }, data: { folderId: folderB } });
    const comments = await prisma.comment.findMany({ where: { designId: design.id } });
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Test comment");
  });
});

describe("Design Move - Bulk", () => {
  let projectId: string;
  let folderA: string;
  let folderB: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    const fA = await createTestFolder(projectId, "Folder A");
    const fB = await createTestFolder(projectId, "Folder B");
    folderA = fA.id;
    folderB = fB.id;
  });

  it("should move multiple designs to a different folder", async () => {
    const d1 = await createTestMarkdownDesign(folderA);
    const d2 = await prisma.design.create({
      data: { name: "Design 2", type: "MARKDOWN", content: "# Two", folderId: folderA, currentVersion: 1, order: 1, versions: { create: { version: 1, content: "# Two" } } },
    });
    await prisma.design.updateMany({ where: { id: { in: [d1.id, d2.id] } }, data: { folderId: folderB } });
    const sourceDesigns = await prisma.design.findMany({ where: { folderId: folderA } });
    expect(sourceDesigns).toHaveLength(0);
    const targetDesigns = await prisma.design.findMany({ where: { folderId: folderB } });
    expect(targetDesigns).toHaveLength(2);
  });
});
