import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("GitHubScraper", () => {
  let GitHubScraper: any;

  beforeEach(async () => {
    mockFetch.mockReset();
    const mod = await import("@/lib/scraper/github");
    GitHubScraper = mod.GitHubScraper;
  });

  it("should list repos for an org with pagination", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        Link: '<https://api.github.com/orgs/test/repos?page=2>; rel="next"',
        "X-RateLimit-Remaining": "50",
        "X-RateLimit-Reset": "9999999999",
      }),
      json: async () => [
        { full_name: "test/repo1", default_branch: "main" },
        { full_name: "test/repo2", default_branch: "develop" },
      ],
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "X-RateLimit-Remaining": "49",
        "X-RateLimit-Reset": "9999999999",
      }),
      json: async () => [
        { full_name: "test/repo3", default_branch: "main" },
      ],
    });

    const repos = [];
    for await (const page of scraper.listRepos("org", "test")) {
      repos.push(...page);
    }

    expect(repos).toHaveLength(3);
    expect(repos[0]).toEqual({ fullName: "test/repo1", defaultBranch: "main" });
    expect(repos[2]).toEqual({ fullName: "test/repo3", defaultBranch: "main" });
  });

  it("should list branches for a repo", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "X-RateLimit-Remaining": "50",
        "X-RateLimit-Reset": "9999999999",
      }),
      json: async () => [
        { name: "main" },
        { name: "develop" },
        { name: "feature/foo" },
      ],
    });

    const branches = await scraper.listBranches("test", "repo1");
    expect(branches).toEqual(["main", "develop", "feature/foo"]);
  });

  it("should get recursive tree and filter markdown files", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": "9999999999" }),
      json: async () => ({ object: { sha: "abc123" } }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": "9999999999" }),
      json: async () => ({
        tree: [
          { path: "README.md", type: "blob", sha: "sha1" },
          { path: "src/index.ts", type: "blob", sha: "sha2" },
          { path: "docs/guide.md", type: "blob", sha: "sha3" },
          { path: "docs", type: "tree", sha: "sha4" },
        ],
      }),
    });

    const sha = await scraper.getBranchSha("test", "repo1", "main");
    expect(sha).toBe("abc123");

    const tree = await scraper.getTreeRecursive("test", "repo1", "abc123");
    const mdFiles = tree.filter((e: any) => e.type === "blob" && e.path.endsWith(".md"));
    expect(mdFiles).toHaveLength(2);
    expect(mdFiles[0].path).toBe("README.md");
    expect(mdFiles[1].path).toBe("docs/guide.md");
  });

  it("should get blob content with base64 decoding", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": "9999999999" }),
      json: async () => ({
        content: Buffer.from("# Hello World\n\nThis is a test.").toString("base64"),
        encoding: "base64",
      }),
    });

    const content = await scraper.getBlobContent("test", "repo1", "sha1");
    expect(content).toBe("# Hello World\n\nThis is a test.");
  });

  it("should track rate limit from response headers", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({
        "X-RateLimit-Remaining": "15",
        "X-RateLimit-Reset": "1700000000",
      }),
      json: async () => [{ name: "main" }],
    });

    await scraper.listBranches("test", "repo1");
    const limit = scraper.getRateLimit();
    expect(limit.remaining).toBe(15);
  });

  it("should return null for getBranchSha when branch does not exist", async () => {
    const scraper = new GitHubScraper("https://api.github.com", "ghp_test");

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": "9999999999" }),
      text: async () => "Not Found",
    });

    const sha = await scraper.getBranchSha("test", "repo1", "deleted-branch");
    expect(sha).toBeNull();
  });
});
