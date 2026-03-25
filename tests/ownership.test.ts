import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestProject,
  createTestFolder,
  createTestUserFolder,
  createTestMarkdownDesign,
} from "./helpers";

describe("Ownership Resolution", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
  });

  it("should identify owner of a user-root folder", async () => {
    const userFolder = await createTestUserFolder(projectId, "alice");
    const folder = await prisma.folder.findUnique({ where: { id: userFolder.id } });
    expect(folder!.ownerUsername).toBe("alice");
  });

  it("should resolve ownership through nested folders", async () => {
    const userFolder = await createTestUserFolder(projectId, "alice");
    const child = await prisma.folder.create({
      data: { name: "Wireframes", projectId, parentId: userFolder.id, order: 0 },
    });

    let current = await prisma.folder.findUnique({ where: { id: child.id } });
    while (current && !current.ownerUsername && current.parentId) {
      current = await prisma.folder.findUnique({ where: { id: current.parentId } });
    }
    expect(current!.ownerUsername).toBe("alice");
  });

  it("should resolve ownership for a design in a nested folder", async () => {
    const userFolder = await createTestUserFolder(projectId, "bob");
    const subFolder = await prisma.folder.create({
      data: { name: "Drafts", projectId, parentId: userFolder.id, order: 0 },
    });
    const design = await createTestMarkdownDesign(subFolder.id);

    let current = await prisma.folder.findUnique({ where: { id: design.folderId } });
    while (current && !current.ownerUsername && current.parentId) {
      current = await prisma.folder.findUnique({ where: { id: current.parentId } });
    }
    expect(current!.ownerUsername).toBe("bob");
  });

  it("should return null for folders with no ownerUsername in chain", async () => {
    const orphanFolder = await createTestFolder(projectId, "Legacy");
    const folder = await prisma.folder.findUnique({ where: { id: orphanFolder.id } });
    expect(folder!.ownerUsername).toBeNull();
  });
});
