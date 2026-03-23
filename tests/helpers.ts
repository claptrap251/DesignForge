import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

// Fresh prisma client pointing at the test DB
export const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL! } },
});

/** Create a test user and return it */
export async function createTestUser(
  overrides: { username?: string; email?: string; name?: string; password?: string } = {}
) {
  const username = overrides.username ?? `test_${Date.now()}`;
  const password = overrides.password ?? "password123";
  const passwordHash = await hash(password, 4); // Low rounds for speed

  return prisma.user.create({
    data: {
      username,
      email: overrides.email ?? null,
      name: overrides.name ?? "Test User",
      passwordHash,
    },
  });
}

/** Create a test project */
export async function createTestProject(ownerId: string | null = null) {
  return prisma.project.create({
    data: {
      name: "Test Project",
      description: "A test project",
      ownerId,
    },
  });
}

/** Create a test folder in a project */
export async function createTestFolder(
  projectId: string,
  name = "Test Folder"
) {
  return prisma.folder.create({
    data: { name, projectId, order: 0 },
  });
}

/** Create a test markdown design in a folder */
export async function createTestMarkdownDesign(
  folderId: string,
  content = "# Hello\n\nSome content"
) {
  return prisma.design.create({
    data: {
      name: "Test Design",
      type: "MARKDOWN",
      content,
      folderId,
      currentVersion: 1,
      order: 0,
      versions: {
        create: { version: 1, content },
      },
    },
    include: { versions: true },
  });
}

/** Clean all data from the test database */
export async function cleanDb() {
  // Delete in dependency order
  await prisma.reply.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.designVersion.deleteMany();
  await prisma.design.deleteMany();
  await prisma.shareLink.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
