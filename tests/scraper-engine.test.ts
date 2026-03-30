import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

function createMockScraper() {
  return {
    getBranchSha: vi.fn().mockResolvedValue("abc123"),
    getTreeRecursive: vi.fn().mockResolvedValue([
      { path: "README.md", type: "blob", sha: "sha1" },
      { path: "docs/guide.md", type: "blob", sha: "sha2" },
      { path: "src/index.ts", type: "blob", sha: "sha3" },
      { path: "docs", type: "tree", sha: "sha4" },
    ]),
    getBlobContent: vi.fn()
      .mockResolvedValueOnce("# README\n\nProject readme content.")
      .mockResolvedValueOnce("# Guide\n\nA helpful guide."),
    getRateLimit: vi.fn().mockReturnValue({ remaining: 100, reset: new Date() }),
    waitForRateLimit: vi.fn().mockResolvedValue(undefined),
  };
}

vi.mock("@/lib/scraper/github", () => ({
  GitHubScraper: class MockGitHubScraper {
    constructor() { return createMockScraper(); }
  },
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("ghp_faketoken"),
}));

describe("scrape engine", () => {
  let runScrape: any;
  let projectId: string;
  let targetId: string;

  beforeEach(async () => {
    await prisma.design.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.scrapeRun.deleteMany();
    await prisma.scrapeRepo.deleteMany();
    await prisma.scrapeTarget.deleteMany();
    await prisma.project.deleteMany();

    const project = await prisma.project.create({
      data: { name: "Test Project" },
    });
    projectId = project.id;

    const target = await prisma.scrapeTarget.create({
      data: {
        name: "test-org",
        githubType: "org",
        githubName: "test-org",
        encryptedToken: "encrypted_token",
        projectId: project.id,
      },
    });
    targetId = target.id;

    await prisma.scrapeRepo.create({
      data: {
        targetId: target.id,
        repoFullName: "test-org/my-repo",
        branch: "main",
        defaultBranch: "main",
        enabled: true,
      },
    });

    // Re-import to get fresh module with mocks
    vi.resetModules();
    vi.doMock("@/lib/scraper/github", () => ({
      GitHubScraper: class MockGitHubScraper {
        constructor() { return createMockScraper(); }
      },
    }));
    vi.doMock("@/lib/crypto", () => ({
      decrypt: vi.fn().mockReturnValue("ghp_faketoken"),
    }));
    const mod = await import("@/lib/scraper/engine");
    runScrape = mod.runScrape;
  });

  it("should create folder hierarchy and designs from scraped markdown", async () => {
    const run = await runScrape(targetId);

    expect(run.status).toBe("success");
    expect(run.filesCreated).toBe(2);
    expect(run.reposScraped).toBe(1);

    const scrapedata = await prisma.folder.findFirst({
      where: { projectId, name: "scrapedata", parentId: null },
    });
    expect(scrapedata).not.toBeNull();
    expect(scrapedata!.ownerUsername).toBeNull();

    const repoFolder = await prisma.folder.findFirst({
      where: { parentId: scrapedata!.id, name: "my-repo" },
    });
    expect(repoFolder).not.toBeNull();

    const docsFolder = await prisma.folder.findFirst({
      where: { parentId: repoFolder!.id, name: "docs" },
    });
    expect(docsFolder).not.toBeNull();

    const readme = await prisma.design.findFirst({
      where: { folderId: repoFolder!.id, name: "README" },
    });
    expect(readme).not.toBeNull();
    expect(readme!.type).toBe("MARKDOWN");
    expect(readme!.content).toBe("# README\n\nProject readme content.");

    const guide = await prisma.design.findFirst({
      where: { folderId: docsFolder!.id, name: "guide" },
    });
    expect(guide).not.toBeNull();
    expect(guide!.content).toBe("# Guide\n\nA helpful guide.");
  });

  it("should generate an index design", async () => {
    await runScrape(targetId);

    const scrapedata = await prisma.folder.findFirst({
      where: { projectId, name: "scrapedata", parentId: null },
    });

    const index = await prisma.design.findFirst({
      where: { folderId: scrapedata!.id, name: "Index" },
    });
    expect(index).not.toBeNull();
    expect(index!.content).toContain("## my-repo");
    expect(index!.content).toContain("- README.md");
    expect(index!.content).toContain("- docs/guide.md");
    expect(index!.content).toContain("test-org");
  });

  it("should update existing designs on re-scrape", async () => {
    await runScrape(targetId);
    const run2 = await runScrape(targetId);

    expect(run2.status).toBe("success");
    expect(run2.filesCreated).toBe(0);
    expect(run2.filesUpdated).toBe(2);

    const designs = await prisma.design.findMany({
      where: { folder: { projectId } },
    });
    expect(designs.filter((d) => d.name !== "Index")).toHaveLength(2);
  });

  it("should create a ScrapeRun record", async () => {
    await runScrape(targetId);

    const runs = await prisma.scrapeRun.findMany({ where: { targetId } });
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");
    expect(runs[0].trigger).toBe("manual");
    expect(runs[0].completedAt).not.toBeNull();
  });
});
