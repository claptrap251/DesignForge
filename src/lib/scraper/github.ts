export interface RepoInfo {
  fullName: string;
  defaultBranch: string;
}

export interface TreeEntry {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export class GitHubScraper {
  private apiUrl: string;
  private token: string;
  private rateLimitRemaining = 5000;
  private rateLimitReset = new Date(0);

  constructor(apiUrl: string, token: string) {
    this.apiUrl = apiUrl.replace(/\/+$/, "");
    this.token = token;
  }

  private async request(url: string, allow404 = false): Promise<Response> {
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    const remaining = res.headers.get("X-RateLimit-Remaining");
    const reset = res.headers.get("X-RateLimit-Reset");
    if (remaining) this.rateLimitRemaining = parseInt(remaining, 10);
    if (reset) this.rateLimitReset = new Date(parseInt(reset, 10) * 1000);

    if (!res.ok && !(allow404 && res.status === 404)) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API ${res.status}: ${body}`);
    }

    return res;
  }

  async waitForRateLimit(): Promise<void> {
    if (this.rateLimitRemaining >= 10) return;
    const waitMs = Math.max(0, this.rateLimitReset.getTime() - Date.now()) + 1000;
    console.log(`[Scraper] Rate limit low (${this.rateLimitRemaining}), waiting ${Math.round(waitMs / 1000)}s...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  async *listRepos(type: "org" | "user", name: string): AsyncGenerator<RepoInfo[]> {
    const base = type === "org" ? "orgs" : "users";
    let url: string | null = `${this.apiUrl}/${base}/${name}/repos?per_page=100`;

    while (url) {
      await this.waitForRateLimit();
      const res = await this.request(url);
      const data = await res.json();

      yield data.map((r: any) => ({
        fullName: r.full_name,
        defaultBranch: r.default_branch,
      }));

      const linkHeader = res.headers.get("Link") || "";
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    await this.waitForRateLimit();
    const res = await this.request(`${this.apiUrl}/repos/${owner}/${repo}/branches?per_page=100`);
    const data = await res.json();
    return data.map((b: any) => b.name);
  }

  async getBranchSha(owner: string, repo: string, branch: string): Promise<string | null> {
    await this.waitForRateLimit();
    const res = await this.request(
      `${this.apiUrl}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
      true
    );
    if (res.status === 404) return null;
    const data = await res.json();
    return data.object.sha;
  }

  async getTreeRecursive(owner: string, repo: string, sha: string): Promise<TreeEntry[]> {
    await this.waitForRateLimit();
    const res = await this.request(
      `${this.apiUrl}/repos/${owner}/${repo}/git/trees/${sha}?recursive=1`
    );
    const data = await res.json();
    return data.tree.map((e: any) => ({
      path: e.path,
      type: e.type,
      sha: e.sha,
      size: e.size,
    }));
  }

  async getBlobContent(owner: string, repo: string, sha: string): Promise<string> {
    await this.waitForRateLimit();
    const res = await this.request(`${this.apiUrl}/repos/${owner}/${repo}/git/blobs/${sha}`);
    const data = await res.json();
    if (data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return data.content;
  }

  getRateLimit(): { remaining: number; reset: Date } {
    return { remaining: this.rateLimitRemaining, reset: this.rateLimitReset };
  }
}
