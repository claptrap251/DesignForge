import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestProject,
  createTestFolder,
  createTestMarkdownDesign,
} from "./helpers";

describe("Designs - Creation", () => {
  let folderId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    const folder = await createTestFolder(project.id);
    folderId = folder.id;
  });

  it("should create a markdown design with version 1", async () => {
    const design = await createTestMarkdownDesign(folderId, "# Hello World");

    expect(design.name).toBe("Test Design");
    expect(design.type).toBe("MARKDOWN");
    expect(design.content).toBe("# Hello World");
    expect(design.currentVersion).toBe(1);
    expect(design.versions).toHaveLength(1);
    expect(design.versions[0].version).toBe(1);
    expect(design.versions[0].content).toBe("# Hello World");
  });

  it("should create an image design with version 1", async () => {
    const design = await prisma.design.create({
      data: {
        name: "logo.png",
        type: "IMAGE",
        filePath: "abc-123.png",
        folderId,
        currentVersion: 1,
        order: 0,
        versions: {
          create: { version: 1, filePath: "abc-123.png" },
        },
      },
      include: { versions: true },
    });

    expect(design.type).toBe("IMAGE");
    expect(design.filePath).toBe("abc-123.png");
    expect(design.versions[0].filePath).toBe("abc-123.png");
  });

  it("should auto-increment order for designs in same folder", async () => {
    const d1 = await prisma.design.create({
      data: {
        name: "d1",
        type: "MARKDOWN",
        content: "a",
        folderId,
        currentVersion: 1,
        order: 0,
        versions: { create: { version: 1, content: "a" } },
      },
    });

    const maxOrder = await prisma.design.aggregate({
      where: { folderId },
      _max: { order: true },
    });

    const d2 = await prisma.design.create({
      data: {
        name: "d2",
        type: "MARKDOWN",
        content: "b",
        folderId,
        currentVersion: 1,
        order: (maxOrder._max.order ?? -1) + 1,
        versions: { create: { version: 1, content: "b" } },
      },
    });

    expect(d1.order).toBe(0);
    expect(d2.order).toBe(1);
  });
});

describe("Designs - Versioning", () => {
  let folderId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    const folder = await createTestFolder(project.id);
    folderId = folder.id;
  });

  it("should create a new version and bump currentVersion", async () => {
    const design = await createTestMarkdownDesign(folderId, "v1 content");

    const updated = await prisma.design.update({
      where: { id: design.id },
      data: {
        content: "v2 content",
        currentVersion: 2,
        versions: {
          create: {
            version: 2,
            content: "v2 content",
            changeNote: "Updated content",
          },
        },
      },
      include: { versions: { orderBy: { version: "desc" } } },
    });

    expect(updated.currentVersion).toBe(2);
    expect(updated.content).toBe("v2 content");
    expect(updated.versions).toHaveLength(2);
    expect(updated.versions[0].version).toBe(2);
    expect(updated.versions[0].changeNote).toBe("Updated content");
    expect(updated.versions[1].version).toBe(1);
  });

  it("should preserve all version history through multiple updates", async () => {
    const design = await createTestMarkdownDesign(folderId, "v1");

    // Version 2
    await prisma.design.update({
      where: { id: design.id },
      data: {
        content: "v2",
        currentVersion: 2,
        versions: { create: { version: 2, content: "v2" } },
      },
    });

    // Version 3
    await prisma.design.update({
      where: { id: design.id },
      data: {
        content: "v3",
        currentVersion: 3,
        versions: { create: { version: 3, content: "v3" } },
      },
    });

    const versions = await prisma.designVersion.findMany({
      where: { designId: design.id },
      orderBy: { version: "asc" },
    });

    expect(versions).toHaveLength(3);
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(versions.map((v) => v.content)).toEqual(["v1", "v2", "v3"]);
  });
});

describe("Designs - Comments", () => {
  let designId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    const folder = await createTestFolder(project.id);
    const design = await createTestMarkdownDesign(folder.id);
    designId = design.id;
  });

  it("should add comments with auto-incrementing pin numbers", async () => {
    const c1 = await prisma.comment.create({
      data: {
        designId,
        xPercent: 10.5,
        yPercent: 20.0,
        pinNumber: 1,
        content: "First comment",
        authorName: "Alice",
      },
    });

    const c2 = await prisma.comment.create({
      data: {
        designId,
        xPercent: 50.0,
        yPercent: 60.0,
        pinNumber: 2,
        content: "Second comment",
        authorName: "Bob",
      },
    });

    expect(c1.pinNumber).toBe(1);
    expect(c2.pinNumber).toBe(2);
    expect(c1.xPercent).toBe(10.5);
    expect(c1.yPercent).toBe(20.0);
  });

  it("should persist comments across version re-uploads", async () => {
    // Add comments to v1
    await prisma.comment.create({
      data: {
        designId,
        xPercent: 25.0,
        yPercent: 40.0,
        pinNumber: 1,
        content: "Needs work",
        authorName: "Alice",
      },
    });
    await prisma.comment.create({
      data: {
        designId,
        xPercent: 60.0,
        yPercent: 70.0,
        pinNumber: 2,
        content: "Looks good",
        authorName: "Bob",
      },
    });

    // Upload version 2
    await prisma.design.update({
      where: { id: designId },
      data: {
        content: "v2 content",
        currentVersion: 2,
        versions: { create: { version: 2, content: "v2 content" } },
      },
    });

    // Verify comments are still attached
    const design = await prisma.design.findUnique({
      where: { id: designId },
      include: {
        comments: { orderBy: { pinNumber: "asc" } },
        versions: { orderBy: { version: "desc" } },
      },
    });

    expect(design!.currentVersion).toBe(2);
    expect(design!.versions).toHaveLength(2);
    expect(design!.comments).toHaveLength(2);
    expect(design!.comments[0].content).toBe("Needs work");
    expect(design!.comments[1].content).toBe("Looks good");
  });

  it("should add replies to comments", async () => {
    const comment = await prisma.comment.create({
      data: {
        designId,
        xPercent: 10,
        yPercent: 20,
        pinNumber: 1,
        content: "Fix this",
        authorName: "Alice",
      },
    });

    const reply = await prisma.reply.create({
      data: {
        commentId: comment.id,
        content: "Done!",
        authorName: "Bob",
      },
    });

    expect(reply.commentId).toBe(comment.id);
    expect(reply.authorName).toBe("Bob");

    const commentWithReplies = await prisma.comment.findUnique({
      where: { id: comment.id },
      include: { replies: true },
    });
    expect(commentWithReplies!.replies).toHaveLength(1);
  });

  it("should resolve comments", async () => {
    const comment = await prisma.comment.create({
      data: {
        designId,
        xPercent: 10,
        yPercent: 20,
        pinNumber: 1,
        content: "Fix this",
        authorName: "Alice",
        resolved: false,
      },
    });

    const resolved = await prisma.comment.update({
      where: { id: comment.id },
      data: { resolved: true },
    });

    expect(resolved.resolved).toBe(true);
  });

  it("should cascade delete comments when design is deleted", async () => {
    await prisma.comment.create({
      data: {
        designId,
        xPercent: 10,
        yPercent: 20,
        pinNumber: 1,
        content: "Test",
        authorName: "Alice",
      },
    });

    await prisma.design.delete({ where: { id: designId } });

    const comments = await prisma.comment.findMany({
      where: { designId },
    });
    expect(comments).toHaveLength(0);
  });
});
