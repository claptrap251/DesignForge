import { getBackupConfig } from "@/lib/admin";

interface GitHubTreeItem {
  path: string;
  mode: "100644" | "100755" | "040000";
  type: "blob" | "tree";
  sha?: string | null;
  content?: string;
}

export class GitHubClient {
  private apiUrl: string;
  private repo: string;
  private token: string;
  private branch: string;

  constructor() {
    const config = getBackupConfig();
    if (!config) throw new Error("GitHub backup not configured");
    this.apiUrl = config.apiUrl;
    this.repo = config.repo;
    this.token = config.token;
    this.branch = config.branch;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.apiUrl}/repos/${this.repo}${endpoint}`;
    // GHE accepts both "Bearer" and "token" prefix; "token" is more universally compatible
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {}),
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`GitHub API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  /** Try to get the latest commit SHA. Returns null if branch doesn't exist. */
  async getLatestCommitSha(): Promise<string | null> {
    try {
      const data = await this.request(`/git/ref/heads/${this.branch}`);
      return data.object.sha;
    } catch (err: any) {
      if (err.message?.includes("404")) return null;
      throw err;
    }
  }

  async getCommitTreeSha(commitSha: string): Promise<string> {
    const data = await this.request(`/git/commits/${commitSha}`);
    return data.tree.sha;
  }

  async getTree(treeSha: string): Promise<Array<{ path: string; sha: string; type: string; size?: number }>> {
    const data = await this.request(`/git/trees/${treeSha}?recursive=1`);
    return data.tree;
  }

  async getBlobContent(sha: string): Promise<string> {
    const data = await this.request(`/git/blobs/${sha}`);
    if (data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return data.content;
  }

  async getBlobRaw(sha: string): Promise<Buffer> {
    const url = `${this.apiUrl}/repos/${this.repo}/git/blobs/${sha}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `token ${this.token}`,
        Accept: "application/vnd.github.raw+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async createTree(items: GitHubTreeItem[], baseTreeSha?: string): Promise<string> {
    const body: any = { tree: items };
    if (baseTreeSha) body.base_tree = baseTreeSha;
    const data = await this.request("/git/trees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return data.sha;
  }

  async createBlob(content: string, encoding: "base64" | "utf-8" = "utf-8"): Promise<string> {
    const data = await this.request("/git/blobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, encoding }),
    });
    return data.sha;
  }

  async createCommit(message: string, treeSha: string, parentSha?: string | null): Promise<string> {
    const data = await this.request("/git/commits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        tree: treeSha,
        parents: parentSha ? [parentSha] : [],
      }),
    });
    return data.sha;
  }

  async updateRef(commitSha: string): Promise<void> {
    await this.request(`/git/refs/heads/${this.branch}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commitSha }),
    });
  }

  /** Create a new branch ref */
  async createRef(commitSha: string): Promise<void> {
    await this.request("/git/refs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${this.branch}`, sha: commitSha }),
    });
  }

  async push(items: GitHubTreeItem[], message: string): Promise<string> {
    const latestCommitSha = await this.getLatestCommitSha();
    const treeSha = await this.createTree(items);
    const commitSha = await this.createCommit(message, treeSha, latestCommitSha);

    if (latestCommitSha) {
      await this.updateRef(commitSha);
    } else {
      // Branch doesn't exist yet — create it
      await this.createRef(commitSha);
    }

    return commitSha;
  }

  async checkConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.request(`/git/ref/heads/${this.branch}`);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }
}
