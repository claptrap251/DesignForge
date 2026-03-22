import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestUser,
  createTestProject,
  createTestFolder,
} from "./helpers";

describe("Projects", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should create a project with owner", async () => {
    const user = await createTestUser();
    const project = await prisma.project.create({
      data: { name: "My Project", description: "Desc", ownerId: user.id },
    });

    expect(project.name).toBe("My Project");
    expect(project.description).toBe("Desc");
    expect(project.ownerId).toBe(user.id);
  });

  it("should create a project without owner", async () => {
    const project = await prisma.project.create({
      data: { name: "Anon Project" },
    });

    expect(project.name).toBe("Anon Project");
    expect(project.ownerId).toBeNull();
  });

  it("should update project name and description", async () => {
    const project = await createTestProject();

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: { name: "Renamed", description: "New desc" },
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.description).toBe("New desc");
  });

  it("should delete a project and cascade to folders and designs", async () => {
    const project = await createTestProject();
    const folder = await createTestFolder(project.id);
    await prisma.design.create({
      data: {
        name: "d1",
        type: "MARKDOWN",
        content: "test",
        folderId: folder.id,
        currentVersion: 1,
        order: 0,
        versions: { create: { version: 1, content: "test" } },
      },
    });

    await prisma.project.delete({ where: { id: project.id } });

    const folders = await prisma.folder.findMany({
      where: { projectId: project.id },
    });
    expect(folders).toHaveLength(0);

    const designs = await prisma.design.findMany({
      where: { folderId: folder.id },
    });
    expect(designs).toHaveLength(0);
  });

  it("should list projects by owner", async () => {
    const user1 = await createTestUser({ email: "u1@test.com" });
    const user2 = await createTestUser({ email: "u2@test.com" });

    await prisma.project.create({
      data: { name: "P1", ownerId: user1.id },
    });
    await prisma.project.create({
      data: { name: "P2", ownerId: user1.id },
    });
    await prisma.project.create({
      data: { name: "P3", ownerId: user2.id },
    });

    const user1Projects = await prisma.project.findMany({
      where: { ownerId: user1.id },
    });
    expect(user1Projects).toHaveLength(2);
  });
});

describe("Folders", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should create a folder in a project", async () => {
    const project = await createTestProject();
    const folder = await createTestFolder(project.id, "Screens");

    expect(folder.name).toBe("Screens");
    expect(folder.projectId).toBe(project.id);
    expect(folder.parentId).toBeNull();
  });

  it("should create nested folders", async () => {
    const project = await createTestProject();
    const parent = await createTestFolder(project.id, "Parent");

    const child = await prisma.folder.create({
      data: {
        name: "Child",
        projectId: project.id,
        parentId: parent.id,
        order: 0,
      },
    });

    expect(child.parentId).toBe(parent.id);

    const parentWithChildren = await prisma.folder.findUnique({
      where: { id: parent.id },
      include: { children: true },
    });
    expect(parentWithChildren!.children).toHaveLength(1);
    expect(parentWithChildren!.children[0].name).toBe("Child");
  });

  it("should cascade delete folders when project is deleted", async () => {
    const project = await createTestProject();
    await createTestFolder(project.id, "F1");
    await createTestFolder(project.id, "F2");

    await prisma.project.delete({ where: { id: project.id } });

    const folders = await prisma.folder.findMany();
    expect(folders).toHaveLength(0);
  });
});
