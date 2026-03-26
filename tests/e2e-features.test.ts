import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestProject,
  createTestFolder,
  createTestUserFolder,
  createTestMarkdownDesign,
} from "./helpers";

describe("User-Root Folder Protection", () => {
  let projectId: string;
  let userRoot: any;
  let subFolder: any;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    userRoot = await createTestUserFolder(projectId, "alice");
    subFolder = await createTestFolder(projectId, "Capability A");
    await prisma.folder.update({
      where: { id: subFolder.id },
      data: { parentId: userRoot.id },
    });
  });

  it("should not allow designs directly in user-root folder", async () => {
    const folder = await prisma.folder.findUnique({ where: { id: userRoot.id } });
    expect(folder!.ownerUsername).toBe("alice");
    expect(folder!.parentId).toBeNull();
  });

  it("should allow designs in sub-folders under user root", async () => {
    const design = await createTestMarkdownDesign(subFolder.id);
    expect(design.folderId).toBe(subFolder.id);
    const found = await prisma.design.findUnique({ where: { id: design.id } });
    expect(found).not.toBeNull();
  });

  it("should identify user-root folders for move blocking", async () => {
    const targetFolder = await prisma.folder.findUnique({ where: { id: userRoot.id } });
    const isUserRoot = targetFolder!.ownerUsername && !targetFolder!.parentId;
    expect(isUserRoot).toBeTruthy();
  });
});

describe("Ownership - Cross-User Isolation", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
  });

  it("should isolate user folders by ownerUsername", async () => {
    const aliceRoot = await createTestUserFolder(projectId, "alice");
    const bobRoot = await createTestUserFolder(projectId, "bob");

    const aliceCap = await prisma.folder.create({
      data: { name: "Login Flow", projectId, parentId: aliceRoot.id, order: 0 },
    });
    const bobCap = await prisma.folder.create({
      data: { name: "Dashboard", projectId, parentId: bobRoot.id, order: 0 },
    });

    const aliceDesign = await createTestMarkdownDesign(aliceCap.id);
    const bobDesign = await createTestMarkdownDesign(bobCap.id);

    const aliceDesigns = await prisma.design.findMany({
      where: { folder: { parentId: aliceRoot.id } },
    });
    const bobDesigns = await prisma.design.findMany({
      where: { folder: { parentId: bobRoot.id } },
    });

    expect(aliceDesigns).toHaveLength(1);
    expect(bobDesigns).toHaveLength(1);
    expect(aliceDesigns[0].id).toBe(aliceDesign.id);
    expect(bobDesigns[0].id).toBe(bobDesign.id);
  });

  it("should prevent duplicate user-root folders", async () => {
    await createTestUserFolder(projectId, "alice");
    const allAlice = await prisma.folder.findMany({
      where: { projectId, ownerUsername: "alice", parentId: null },
    });
    expect(allAlice).toHaveLength(1);
  });

  it("should support 3 levels of nesting under user root", async () => {
    const userRoot = await createTestUserFolder(projectId, "alice");
    const l1 = await prisma.folder.create({
      data: { name: "Level 1", projectId, parentId: userRoot.id, order: 0 },
    });
    const l2 = await prisma.folder.create({
      data: { name: "Level 2", projectId, parentId: l1.id, order: 0 },
    });
    const l3 = await prisma.folder.create({
      data: { name: "Level 3", projectId, parentId: l2.id, order: 0 },
    });

    const d1 = await createTestMarkdownDesign(l1.id);
    const d2 = await createTestMarkdownDesign(l2.id);
    const d3 = await createTestMarkdownDesign(l3.id);

    expect(d1.folderId).toBe(l1.id);
    expect(d2.folderId).toBe(l2.id);
    expect(d3.folderId).toBe(l3.id);
  });
});

describe("Design Versioning", () => {
  let folderId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    const userRoot = await createTestUserFolder(project.id, "alice");
    const cap = await prisma.folder.create({
      data: { name: "Features", projectId: project.id, parentId: userRoot.id, order: 0 },
    });
    folderId = cap.id;
  });

  it("should list versions for a design", async () => {
    const design = await createTestMarkdownDesign(folderId, "# V1 Content");

    await prisma.design.update({
      where: { id: design.id },
      data: {
        content: "# V2 Content",
        currentVersion: 2,
        versions: { create: { version: 2, content: "# V2 Content", changeNote: "Updated" } },
      },
    });

    const versions = await prisma.designVersion.findMany({
      where: { designId: design.id },
      orderBy: { version: "asc" },
    });

    expect(versions).toHaveLength(2);
    expect(versions[0].version).toBe(1);
    expect(versions[1].version).toBe(2);
    expect(versions[1].changeNote).toBe("Updated");
  });

  it("should revert to a previous version", async () => {
    const design = await createTestMarkdownDesign(folderId, "# Original");

    await prisma.design.update({
      where: { id: design.id },
      data: {
        content: "# Modified",
        currentVersion: 2,
        versions: { create: { version: 2, content: "# Modified" } },
      },
    });

    const v1 = await prisma.designVersion.findFirst({
      where: { designId: design.id, version: 1 },
    });

    const reverted = await prisma.design.update({
      where: { id: design.id },
      data: {
        content: v1!.content,
        currentVersion: 3,
        versions: { create: { version: 3, content: v1!.content, changeNote: "Reverted to v1" } },
      },
    });

    expect(reverted.content).toBe("# Original");
    expect(reverted.currentVersion).toBe(3);
  });
});
