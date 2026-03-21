import { describe, it, expect, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";
import crypto from "crypto";
import {
  prisma,
  cleanDb,
  createTestUser,
  createTestProject,
  createTestFolder,
  createTestMarkdownDesign,
} from "./helpers";

describe("Share Links", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const user = await createTestUser();
    const project = await createTestProject(user.id);
    projectId = project.id;
    const folder = await createTestFolder(project.id, "Designs");
    await createTestMarkdownDesign(folder.id, "# Shared content");
  });

  it("should create a share link with unique token", async () => {
    const token = crypto.randomUUID();
    const shareLink = await prisma.shareLink.create({
      data: { projectId, token },
    });

    expect(shareLink.token).toBe(token);
    expect(shareLink.projectId).toBe(projectId);
    expect(shareLink.passwordHash).toBeNull();
    expect(shareLink.expiresAt).toBeNull();
  });

  it("should retrieve project via share token", async () => {
    const token = crypto.randomUUID();
    await prisma.shareLink.create({ data: { projectId, token } });

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
    });
    expect(shareLink).not.toBeNull();

    const project = await prisma.project.findUnique({
      where: { id: shareLink!.projectId },
      include: {
        folders: {
          include: { designs: true },
          where: { parentId: null },
        },
      },
    });

    expect(project).not.toBeNull();
    expect(project!.name).toBe("Test Project");
    expect(project!.folders).toHaveLength(1);
    expect(project!.folders[0].designs).toHaveLength(1);
    expect(project!.folders[0].designs[0].content).toBe("# Shared content");
  });

  it("should create password-protected share links", async () => {
    const token = crypto.randomUUID();
    const passwordHash = await hash("sharepass", 4);

    await prisma.shareLink.create({
      data: { projectId, token, passwordHash },
    });

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
    });

    expect(shareLink!.passwordHash).not.toBeNull();

    const isValid = await compare("sharepass", shareLink!.passwordHash!);
    expect(isValid).toBe(true);

    const isWrong = await compare("wrong", shareLink!.passwordHash!);
    expect(isWrong).toBe(false);
  });

  it("should detect expired share links", async () => {
    const token = crypto.randomUUID();
    const pastDate = new Date(Date.now() - 86400000); // 1 day ago

    await prisma.shareLink.create({
      data: { projectId, token, expiresAt: pastDate },
    });

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
    });

    expect(shareLink!.expiresAt!.getTime()).toBeLessThan(Date.now());
  });

  it("should allow non-expired share links", async () => {
    const token = crypto.randomUUID();
    const futureDate = new Date(Date.now() + 86400000); // 1 day from now

    await prisma.shareLink.create({
      data: { projectId, token, expiresAt: futureDate },
    });

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
    });

    expect(shareLink!.expiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should return null for invalid token", async () => {
    const shareLink = await prisma.shareLink.findUnique({
      where: { token: "nonexistent-token" },
    });
    expect(shareLink).toBeNull();
  });

  it("should scope share link to a specific folder", async () => {
    const folder = await prisma.folder.findFirst({
      where: { projectId },
    });

    const token = crypto.randomUUID();
    await prisma.shareLink.create({
      data: { projectId, token, folderId: folder!.id },
    });

    const shareLink = await prisma.shareLink.findUnique({
      where: { token },
    });

    expect(shareLink!.folderId).toBe(folder!.id);
  });

  it("should cascade delete share links when project is deleted", async () => {
    const token = crypto.randomUUID();
    await prisma.shareLink.create({ data: { projectId, token } });

    await prisma.project.delete({ where: { id: projectId } });

    const shareLinks = await prisma.shareLink.findMany({
      where: { projectId },
    });
    expect(shareLinks).toHaveLength(0);
  });
});
