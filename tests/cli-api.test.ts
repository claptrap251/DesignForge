import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

describe("CLI API", () => {
  let projectId: string;
  let folderId: string;

  beforeEach(async () => {
    await prisma.design.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.project.deleteMany();

    const project = await prisma.project.create({
      data: { name: "CLI Test Project" },
    });
    projectId = project.id;

    const rootFolder = await prisma.folder.create({
      data: { name: "testuser", projectId, ownerUsername: "testuser", order: 0 },
    });

    const subFolder = await prisma.folder.create({
      data: { name: "docs", projectId, parentId: rootFolder.id, order: 0 },
    });
    folderId = subFolder.id;

    await prisma.design.create({
      data: {
        name: "test-doc",
        type: "MARKDOWN",
        content: "# Test Document\n\nSome content here.",
        folderId: subFolder.id,
        currentVersion: 1,
        order: 0,
        versions: { create: { version: 1, content: "# Test Document\n\nSome content here." } },
      },
    });
  });

  describe("resolveDesignByPath", () => {
    it("should resolve a file by project and path", async () => {
      const { resolveDesignByPath } = await import("@/app/api/cli/files/route");
      const result = await resolveDesignByPath(projectId, "testuser/docs/test-doc");

      expect(result).not.toBeNull();
      expect(result!.name).toBe("test-doc");
      expect(result!.content).toBe("# Test Document\n\nSome content here.");
    });

    it("should return null for non-existent path", async () => {
      const { resolveDesignByPath } = await import("@/app/api/cli/files/route");
      const result = await resolveDesignByPath(projectId, "testuser/docs/nonexistent");

      expect(result).toBeNull();
    });

    it("should return null for empty path", async () => {
      const { resolveDesignByPath } = await import("@/app/api/cli/files/route");
      const result = await resolveDesignByPath(projectId, "");

      expect(result).toBeNull();
    });
  });

  describe("projects endpoint", () => {
    it("should list projects", async () => {
      const projects = await prisma.project.findMany({
        select: { id: true, name: true, description: true },
      });

      expect(projects.length).toBeGreaterThan(0);
      expect(projects[0].name).toBe("CLI Test Project");
    });
  });
});
