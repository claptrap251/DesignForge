# GitHub Markdown Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub org/user markdown scraping with DB-stored config, migrate backup config from env vars to DB, and provide an admin UI for managing multiple scrape targets.

**Architecture:** Inline in Next.js via node-cron. New `src/lib/crypto.ts` for shared token encryption. New `src/lib/scraper/` module with GitHubScraper client, engine, and scheduler. Admin UI adds Backup and Scraper tabs. All config stored in DB with encrypted tokens.

**Tech Stack:** Next.js 16, TypeScript, Prisma 6 (SQLite), node-cron, AES-256-GCM (Node.js crypto), Tailwind CSS v4

**Spec:** `docs/superpowers/specs/2026-03-29-github-scraper-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt using ENCRYPTION_KEY env var |
| `src/lib/scraper/github.ts` | GitHubScraper client — multi-repo read-only GitHub API operations |
| `src/lib/scraper/engine.ts` | Scrape orchestrator — runs a full scrape for a target, creates folders/designs |
| `src/lib/scraper/scheduler.ts` | node-cron registration for scrape targets |
| `src/lib/scraper/index.ts` | Public re-exports |
| `src/app/api/admin/config/route.ts` | Rewrite — backup config CRUD from DB |
| `src/app/api/admin/scraper/config/route.ts` | GET all targets, POST new target |
| `src/app/api/admin/scraper/config/[id]/route.ts` | PUT/DELETE a scrape target |
| `src/app/api/admin/scraper/repos/route.ts` | POST fetch repos from GitHub, PUT save selections |
| `src/app/api/admin/scraper/branches/[repo]/route.ts` | GET branches for a repo |
| `src/app/api/admin/scraper/run/route.ts` | POST trigger scrape |
| `src/app/api/admin/scraper/history/route.ts` | GET scrape runs |
| `tests/crypto.test.ts` | Tests for encrypt/decrypt |
| `tests/scraper-github.test.ts` | Tests for GitHubScraper client |
| `tests/scraper-engine.test.ts` | Tests for scrape engine |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add BackupConfig, ScrapeTarget, ScrapeRepo, ScrapeRun models; add relation to Project |
| `src/lib/admin.ts` | Replace `getBackupConfig()` to read from DB; add `getBackupConfigFromDb()` |
| `src/lib/backup/scheduler.ts` | Read config from DB instead of env vars |
| `src/lib/backup/github.ts` | Accept config in constructor instead of reading from env |
| `src/instrumentation.ts` | Add backup config migration, start scrape scheduler |
| `src/app/admin/page.tsx` | Full rewrite — tabbed layout with Backup and Scraper tabs, dark mode |
| `src/app/api/admin/backup/route.ts` | Read config from DB |
| `.env.example` | Add ENCRYPTION_KEY |

---

## Task 1: Crypto Module

**Files:**
- Create: `src/lib/crypto.ts`
- Create: `tests/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/crypto.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("crypto", () => {
  it("should encrypt and decrypt a string", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const plaintext = "ghp_abc123secrettoken";
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it("should produce different ciphertexts for the same input (random IV)", async () => {
    const { encrypt } = await import("@/lib/crypto");
    const plaintext = "ghp_abc123secrettoken";
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
  });

  it("should throw on tampered ciphertext", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    const encrypted = encrypt("test");
    const tampered = encrypted.slice(0, -4) + "AAAA";
    expect(() => decrypt(tampered)).toThrow();
  });

  it("should use ENCRYPTION_KEY env var, falling back to NEXTAUTH_SECRET", async () => {
    const { encrypt, decrypt } = await import("@/lib/crypto");
    // tests/setup.ts sets NEXTAUTH_SECRET="test-secret-for-vitest"
    // Since ENCRYPTION_KEY is not set, it should use NEXTAUTH_SECRET
    const encrypted = encrypt("fallback-test");
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe("fallback-test");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/crypto.test.ts`
Expected: FAIL — cannot find module `@/lib/crypto`

- [ ] **Step 3: Write implementation**

Create `src/lib/crypto.ts`:

```typescript
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("ENCRYPTION_KEY or NEXTAUTH_SECRET must be set for token encryption");
  }
  return createHash("sha256").update(secret).digest();
}

/** Encrypt plaintext using AES-256-GCM. Returns base64(iv + ciphertext + authTag). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString("base64");
}

/** Decrypt a base64 string produced by encrypt(). */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/crypto.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts tests/crypto.test.ts
git commit -m "feat: add AES-256-GCM crypto module for token encryption"
```

---

## Task 2: Prisma Schema — New Models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models to schema**

Append after `ShareLink` model (after line 121) in `prisma/schema.prisma`:

```prisma
model BackupConfig {
  id             String   @id @default(cuid())
  apiUrl         String   @default("https://api.github.com")
  repo           String
  encryptedToken String
  branch         String   @default("main")
  cronSchedule   String   @default("0 2 * * *")
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ScrapeTarget {
  id             String       @id @default(cuid())
  name           String
  githubType     String
  githubName     String
  apiUrl         String       @default("https://api.github.com")
  encryptedToken String
  cronSchedule   String       @default("0 */12 * * *")
  enabled        Boolean      @default(true)
  projectId      String
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  repos          ScrapeRepo[]
  runs           ScrapeRun[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model ScrapeRepo {
  id            String       @id @default(cuid())
  targetId      String
  target        ScrapeTarget @relation(fields: [targetId], references: [id], onDelete: Cascade)
  repoFullName  String
  branch        String
  defaultBranch String
  enabled       Boolean      @default(true)
  createdAt     DateTime     @default(now())
}

model ScrapeRun {
  id            String       @id @default(cuid())
  targetId      String
  target        ScrapeTarget @relation(fields: [targetId], references: [id], onDelete: Cascade)
  trigger       String
  status        String
  filesFound    Int          @default(0)
  filesUpdated  Int          @default(0)
  filesCreated  Int          @default(0)
  reposScraped  Int          @default(0)
  reposSkipped  Int          @default(0)
  error         String?
  log           String?
  startedAt     DateTime     @default(now())
  completedAt   DateTime?
}
```

- [ ] **Step 2: Add ScrapeTarget relation to Project model**

In the `Project` model (line 22-32), add after `shareLinks  ShareLink[]`:

```prisma
  scrapeTargets ScrapeTarget[]
```

- [ ] **Step 3: Push schema to dev database**

Run: `npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 4: Verify existing tests still pass**

Run: `npx vitest run tests/crypto.test.ts tests/auth.test.ts tests/ownership.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add BackupConfig, ScrapeTarget, ScrapeRepo, ScrapeRun models"
```

---

## Task 3: Backup Config Migration (env vars → DB)

**Files:**
- Modify: `src/lib/admin.ts`
- Modify: `src/lib/backup/github.ts` (constructor)
- Modify: `src/lib/backup/scheduler.ts`
- Modify: `src/app/api/admin/config/route.ts`
- Modify: `src/app/api/admin/backup/route.ts`
- Modify: `src/instrumentation.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update `.env.example`**

Add at the top, before `DATABASE_URL`:

```
# Encryption key for tokens stored in the database.
# Falls back to NEXTAUTH_SECRET if not set.
# ENCRYPTION_KEY="your-random-secret-key"
```

- [ ] **Step 2: Rewrite `src/lib/admin.ts`**

Replace `getBackupConfig()` with a DB-reading version:

```typescript
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

/**
 * Check if the current session user is the admin.
 * Admin is determined by ADMIN_USERNAME env var.
 */
export function isAdmin(session: any): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return false;
  return session?.user?.username === adminUsername;
}

/**
 * Get backup configuration from the database.
 * Returns null if not configured.
 */
export async function getBackupConfig() {
  const config = await prisma.backupConfig.findFirst();
  if (!config) return null;

  return {
    id: config.id,
    apiUrl: config.apiUrl.replace(/\/+$/, ""),
    repo: config.repo,
    token: decrypt(config.encryptedToken),
    branch: config.branch,
    cron: config.cronSchedule,
    enabled: config.enabled,
  };
}

/**
 * Migrate backup config from env vars to DB (one-time, on startup).
 * Only runs if DB has no BackupConfig rows AND env vars are present.
 */
export async function migrateBackupConfigFromEnv(): Promise<boolean> {
  const existing = await prisma.backupConfig.findFirst();
  if (existing) return false;

  const repo = process.env.GITHUB_BACKUP_REPO;
  const token = process.env.GITHUB_BACKUP_TOKEN;
  if (!repo || !token) return false;

  const { encrypt } = await import("@/lib/crypto");

  await prisma.backupConfig.create({
    data: {
      apiUrl: (process.env.GITHUB_BACKUP_URL || "https://api.github.com").replace(/\/+$/, ""),
      repo,
      encryptedToken: encrypt(token),
      branch: process.env.GITHUB_BACKUP_BRANCH || "main",
      cronSchedule: process.env.BACKUP_SCHEDULE_CRON || "0 2 * * *",
      enabled: true,
    },
  });

  console.log("[Migration] Backup config migrated from env vars to database");
  return true;
}
```

- [ ] **Step 3: Update `src/lib/backup/github.ts` constructor**

Change the `GitHubClient` constructor (lines 17-24) to accept config as a parameter instead of reading from env:

```typescript
export class GitHubClient {
  private apiUrl: string;
  private repo: string;
  private token: string;
  private branch: string;

  constructor(config: { apiUrl: string; repo: string; token: string; branch: string }) {
    this.apiUrl = config.apiUrl;
    this.repo = config.repo;
    this.token = config.token;
    this.branch = config.branch;
  }
```

- [ ] **Step 4: Update `src/lib/backup/scheduler.ts`**

Change `runBackup` (line 47) and `startScheduler` (line 90) to use the async `getBackupConfig`:

```typescript
import cron, { type ScheduledTask } from "node-cron";
import { getBackupConfig } from "@/lib/admin";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

interface BackupHistoryEntry {
  timestamp: string;
  type: "auto" | "manual";
  status: "success" | "partial" | "failed";
  fileCount: number;
  stats?: { users: number; projects: number; designs: number; comments: number };
  error?: string;
}

const HISTORY_PATH = path.join(process.cwd(), "data", "backup-history.json");

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  try {
    const data = await readFile(HISTORY_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addBackupHistoryEntry(entry: BackupHistoryEntry): Promise<void> {
  const history = await getBackupHistory();
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
}

export async function runBackup(type: "auto" | "manual"): Promise<BackupHistoryEntry> {
  const config = await getBackupConfig();
  if (!config) throw new Error("Backup not configured");

  const { serializeBackup } = await import("@/lib/backup/serialize");
  const { GitHubClient } = await import("@/lib/backup/github");

  const entry: BackupHistoryEntry = {
    timestamp: new Date().toISOString(),
    type,
    status: "failed",
    fileCount: 0,
  };

  try {
    const { files, stats } = await serializeBackup();
    const client = new GitHubClient(config);

    const treeItems = [];
    for (const file of files) {
      if ("binary" in file && file.binary) {
        const blobSha = await client.createBlob(
          (file.content as Buffer).toString("base64"),
          "base64"
        );
        treeItems.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blobSha,
        });
      } else {
        treeItems.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          content: file.content as string,
        });
      }
    }

    const now = new Date();
    const message = `Backup ${now.toISOString().slice(0, 16).replace("T", " ")} (${type})`;
    await client.push(treeItems, message);

    entry.status = "success";
    entry.fileCount = files.length;
    entry.stats = stats;
  } catch (err: any) {
    entry.status = "failed";
    entry.error = err.message || "Unknown error";
  }

  await addBackupHistoryEntry(entry);
  return entry;
}

let scheduledTask: ScheduledTask | null = null;

export async function startScheduler(): Promise<void> {
  const config = await getBackupConfig();
  if (!config || !config.enabled) return;

  if (scheduledTask) {
    scheduledTask.stop();
  }

  if (!cron.validate(config.cron)) {
    console.error(`[Backup] Invalid cron expression: ${config.cron}`);
    return;
  }

  scheduledTask = cron.schedule(config.cron, async () => {
    console.log("[Backup] Starting scheduled backup...");
    const result = await runBackup("auto");
    console.log(`[Backup] Completed: ${result.status} (${result.fileCount} files)`);
  });

  console.log(`[Backup] Scheduler started with cron: ${config.cron}`);
}
```

- [ ] **Step 5: Rewrite `src/app/api/admin/config/route.ts`**

Add POST handler for creating/updating backup config:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getBackupConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    id: config.id,
    apiUrl: config.apiUrl,
    repo: config.repo,
    branch: config.branch,
    cron: config.cron,
    enabled: config.enabled,
    tokenPreview: config.token.slice(0, 4) + "••••••••",
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { apiUrl, repo, branch, cronSchedule, enabled, token } = body;

  if (!repo) {
    return NextResponse.json({ error: "Repository is required" }, { status: 400 });
  }

  const existing = await prisma.backupConfig.findFirst();

  const data: any = {
    apiUrl: (apiUrl || "https://api.github.com").replace(/\/+$/, ""),
    repo,
    branch: branch || "main",
    cronSchedule: cronSchedule || "0 2 * * *",
    enabled: enabled !== false,
  };

  // Only update token if a new one is provided
  if (token) {
    data.encryptedToken = encrypt(token);
  }

  if (existing) {
    await prisma.backupConfig.update({ where: { id: existing.id }, data });
  } else {
    if (!token) {
      return NextResponse.json({ error: "Token is required for initial setup" }, { status: 400 });
    }
    data.encryptedToken = encrypt(token);
    await prisma.backupConfig.create({ data });
  }

  // Restart backup scheduler with new config
  const { startScheduler } = await import("@/lib/backup/scheduler");
  await startScheduler();

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Update `src/app/api/admin/backup/route.ts`**

Change to use async `getBackupConfig`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { getBackupHistory, runBackup } from "@/lib/backup/scheduler";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const history = await getBackupHistory();
  return NextResponse.json({ history });
}

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getBackupConfig();
  if (!config) {
    return NextResponse.json({ error: "Backup not configured" }, { status: 400 });
  }

  const result = await runBackup("manual");
  return NextResponse.json(result);
}
```

- [ ] **Step 7: Update `src/instrumentation.ts`**

Add backup config migration before starting scheduler:

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateBackupConfigFromEnv } = await import("@/lib/admin");
    await migrateBackupConfigFromEnv();

    const { startScheduler } = await import("@/lib/backup/scheduler");
    await startScheduler();

    const { runSharedProjectsMigration } = await import("@/lib/migration");
    await runSharedProjectsMigration();
  }
}
```

- [ ] **Step 8: Run existing tests to verify no regressions**

Run: `npx vitest run tests/auth.test.ts tests/ownership.test.ts tests/designs.test.ts`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add src/lib/admin.ts src/lib/backup/github.ts src/lib/backup/scheduler.ts \
  src/app/api/admin/config/route.ts src/app/api/admin/backup/route.ts \
  src/instrumentation.ts .env.example
git commit -m "feat: migrate backup config from env vars to database"
```

---

## Task 4: GitHubScraper Client

**Files:**
- Create: `src/lib/scraper/github.ts`
- Create: `tests/scraper-github.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/scraper-github.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally for these tests
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

    // Page 1 — has Link header pointing to page 2
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

    // Page 2 — no next link
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

    // getBranchSha
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": "9999999999" }),
      json: async () => ({ object: { sha: "abc123" } }),
    });

    // getTreeRecursive
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scraper-github.test.ts`
Expected: FAIL — cannot find module `@/lib/scraper/github`

- [ ] **Step 3: Write implementation**

Create `src/lib/scraper/github.ts`:

```typescript
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

    // Track rate limit from every response
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

  /** Pause if rate limit is critically low (< 10 remaining). */
  async waitForRateLimit(): Promise<void> {
    if (this.rateLimitRemaining >= 10) return;
    const waitMs = Math.max(0, this.rateLimitReset.getTime() - Date.now()) + 1000;
    console.log(`[Scraper] Rate limit low (${this.rateLimitRemaining}), waiting ${Math.round(waitMs / 1000)}s...`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  /** List all repos for an org or user, yielding pages. */
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

      // Parse Link header for pagination
      const linkHeader = res.headers.get("Link") || "";
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }
  }

  /** List branch names for a repo. */
  async listBranches(owner: string, repo: string): Promise<string[]> {
    await this.waitForRateLimit();
    const res = await this.request(`${this.apiUrl}/repos/${owner}/${repo}/branches?per_page=100`);
    const data = await res.json();
    return data.map((b: any) => b.name);
  }

  /** Get the commit SHA for a branch. Returns null if branch doesn't exist. */
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

  /** Get the full recursive tree for a commit SHA. */
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

  /** Get the decoded text content of a blob. */
  async getBlobContent(owner: string, repo: string, sha: string): Promise<string> {
    await this.waitForRateLimit();
    const res = await this.request(`${this.apiUrl}/repos/${owner}/${repo}/git/blobs/${sha}`);
    const data = await res.json();
    if (data.encoding === "base64") {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return data.content;
  }

  /** Get current rate limit state. */
  getRateLimit(): { remaining: number; reset: Date } {
    return { remaining: this.rateLimitRemaining, reset: this.rateLimitReset };
  }
}
```

- [ ] **Step 4: Create re-export index**

Create `src/lib/scraper/index.ts`:

```typescript
export { GitHubScraper } from "./github";
export type { RepoInfo, TreeEntry } from "./github";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/scraper-github.test.ts`
Expected: 6 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/scraper/github.ts src/lib/scraper/index.ts tests/scraper-github.test.ts
git commit -m "feat: add GitHubScraper client with pagination and rate limiting"
```

---

## Task 5: Scrape Engine

**Files:**
- Create: `src/lib/scraper/engine.ts`
- Create: `tests/scraper-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/scraper-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/db";

// Mock the GitHubScraper
vi.mock("@/lib/scraper/github", () => ({
  GitHubScraper: vi.fn().mockImplementation(() => ({
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
  })),
}));

vi.mock("@/lib/crypto", () => ({
  decrypt: vi.fn().mockReturnValue("ghp_faketoken"),
}));

describe("scrape engine", () => {
  let runScrape: any;
  let projectId: string;
  let targetId: string;

  beforeEach(async () => {
    // Clean up
    await prisma.design.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.scrapeRun.deleteMany();
    await prisma.scrapeRepo.deleteMany();
    await prisma.scrapeTarget.deleteMany();
    await prisma.project.deleteMany();

    // Create a project
    const project = await prisma.project.create({
      data: { name: "Test Project" },
    });
    projectId = project.id;

    // Create a scrape target
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

    // Create a scrape repo
    await prisma.scrapeRepo.create({
      data: {
        targetId: target.id,
        repoFullName: "test-org/my-repo",
        branch: "main",
        defaultBranch: "main",
        enabled: true,
      },
    });

    const mod = await import("@/lib/scraper/engine");
    runScrape = mod.runScrape;
  });

  it("should create folder hierarchy and designs from scraped markdown", async () => {
    const run = await runScrape(targetId);

    expect(run.status).toBe("success");
    expect(run.filesCreated).toBe(2);
    expect(run.reposScraped).toBe(1);

    // Check folder structure: scrapedata -> my-repo -> docs
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

    // Check designs
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
    expect(index!.content).toContain("my-repo: README.md, docs/guide.md");
    expect(index!.content).toContain("test-org");
  });

  it("should update existing designs on re-scrape", async () => {
    await runScrape(targetId);
    const run2 = await runScrape(targetId);

    expect(run2.status).toBe("success");
    expect(run2.filesCreated).toBe(0);
    expect(run2.filesUpdated).toBe(2);

    // Should still have same number of designs, not duplicates
    const designs = await prisma.design.findMany({
      where: { folder: { projectId } },
    });
    // 2 markdown files + 1 index = 3
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/scraper-engine.test.ts`
Expected: FAIL — cannot find module `@/lib/scraper/engine`

- [ ] **Step 3: Write implementation**

Create `src/lib/scraper/engine.ts`:

```typescript
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "./github";

interface ScrapeResult {
  status: "success" | "partial" | "failed";
  filesFound: number;
  filesCreated: number;
  filesUpdated: number;
  reposScraped: number;
  reposSkipped: number;
  error?: string;
}

/** Get or create a folder by name under a parent. */
async function ensureFolder(
  projectId: string,
  parentId: string | null,
  name: string
): Promise<string> {
  const existing = await prisma.folder.findFirst({
    where: { projectId, parentId, name },
  });
  if (existing) return existing.id;

  const maxOrder = await prisma.folder.aggregate({
    where: { projectId, parentId },
    _max: { order: true },
  });

  const folder = await prisma.folder.create({
    data: {
      name,
      projectId,
      parentId,
      ownerUsername: null,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  return folder.id;
}

/** Create or update a markdown design in a folder. */
async function upsertDesign(
  folderId: string,
  name: string,
  content: string
): Promise<"created" | "updated"> {
  const existing = await prisma.design.findFirst({
    where: { folderId, name },
  });

  if (existing) {
    await prisma.design.update({
      where: { id: existing.id },
      data: { content },
    });
    return "updated";
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  await prisma.design.create({
    data: {
      name,
      type: "MARKDOWN",
      status: "DRAFT",
      content,
      folderId,
      currentVersion: 1,
      order: (maxOrder._max.order ?? -1) + 1,
      versions: { create: { version: 1, content } },
    },
  });
  return "created";
}

/** Strip .md / .markdown extension from a filename. */
function stripMdExtension(filename: string): string {
  return filename.replace(/\.(md|markdown)$/i, "");
}

/** Run a full scrape for a target. */
export async function runScrape(
  targetId: string,
  trigger: "auto" | "manual" = "manual"
): Promise<ScrapeResult> {
  const target = await prisma.scrapeTarget.findUnique({
    where: { id: targetId },
    include: { repos: { where: { enabled: true } } },
  });

  if (!target) throw new Error(`Scrape target ${targetId} not found`);

  // Create run record
  const run = await prisma.scrapeRun.create({
    data: { targetId, trigger, status: "running" },
  });

  const result: ScrapeResult = {
    status: "success",
    filesFound: 0,
    filesCreated: 0,
    filesUpdated: 0,
    reposScraped: 0,
    reposSkipped: 0,
  };

  const log: string[] = [];
  // Tracks repo -> list of file paths for index generation
  const indexData: Map<string, string[]> = new Map();

  try {
    const token = decrypt(target.encryptedToken);
    const scraper = new GitHubScraper(target.apiUrl, token);

    // Ensure scrapedata root folder
    const scrapedataId = await ensureFolder(target.projectId, null, "scrapedata");

    for (const repo of target.repos) {
      const [owner, repoName] = repo.repoFullName.split("/");

      try {
        // Get branch SHA (fall back to default branch if selected branch is gone)
        let sha = await scraper.getBranchSha(owner, repoName, repo.branch);
        if (!sha && repo.branch !== repo.defaultBranch) {
          log.push(`[${repo.repoFullName}] Branch "${repo.branch}" not found, falling back to "${repo.defaultBranch}"`);
          sha = await scraper.getBranchSha(owner, repoName, repo.defaultBranch);
        }
        if (!sha) {
          log.push(`[${repo.repoFullName}] No valid branch found, skipping`);
          result.reposSkipped++;
          continue;
        }

        // Get tree and filter for .md files
        const tree = await scraper.getTreeRecursive(owner, repoName, sha);
        const mdFiles = tree.filter((e) => e.type === "blob" && e.path.endsWith(".md"));
        result.filesFound += mdFiles.length;

        if (mdFiles.length === 0) {
          log.push(`[${repo.repoFullName}] No markdown files found, skipping`);
          result.reposSkipped++;
          continue;
        }

        // Ensure repo folder under scrapedata
        const repoFolderId = await ensureFolder(target.projectId, scrapedataId, repoName);
        const filePaths: string[] = [];

        for (const file of mdFiles) {
          const content = await scraper.getBlobContent(owner, repoName, file.sha);
          const parts = file.path.split("/");
          const filename = parts.pop()!;
          const designName = stripMdExtension(filename);

          // Create intermediate folders
          let currentFolderId = repoFolderId;
          for (const dir of parts) {
            currentFolderId = await ensureFolder(target.projectId, currentFolderId, dir);
          }

          // Create or update design
          const action = await upsertDesign(currentFolderId, designName, content);
          if (action === "created") result.filesCreated++;
          else result.filesUpdated++;

          filePaths.push(file.path);
        }

        indexData.set(repoName, filePaths);
        result.reposScraped++;
        log.push(`[${repo.repoFullName}] Scraped ${mdFiles.length} files`);
      } catch (err: any) {
        log.push(`[${repo.repoFullName}] Error: ${err.message}`);
        result.reposSkipped++;
      }
    }

    // Generate index
    const totalFiles = Array.from(indexData.values()).reduce((sum, f) => sum + f.length, 0);
    const now = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
    let indexContent = `# Scraped Markdown Index\n\n> Last synced ${now} | Source: ${target.githubName} | ${indexData.size} repos, ${totalFiles} files\n\n`;
    for (const [repoName, files] of indexData) {
      indexContent += `${repoName}: ${files.join(", ")}\n`;
    }
    await upsertDesign(scrapedataId, "Index", indexContent.trimEnd());

    // Determine final status
    if (result.reposSkipped > 0 && result.reposScraped > 0) {
      result.status = "partial";
    } else if (result.reposScraped === 0 && target.repos.length > 0) {
      result.status = "failed";
    }
  } catch (err: any) {
    result.status = "failed";
    result.error = err.message;
    log.push(`Fatal error: ${err.message}`);
  }

  // Update run record
  await prisma.scrapeRun.update({
    where: { id: run.id },
    data: {
      status: result.status,
      filesFound: result.filesFound,
      filesCreated: result.filesCreated,
      filesUpdated: result.filesUpdated,
      reposScraped: result.reposScraped,
      reposSkipped: result.reposSkipped,
      error: result.error,
      log: JSON.stringify(log),
      completedAt: new Date(),
    },
  });

  return result;
}
```

- [ ] **Step 4: Update re-export index**

Add to `src/lib/scraper/index.ts`:

```typescript
export { GitHubScraper } from "./github";
export type { RepoInfo, TreeEntry } from "./github";
export { runScrape } from "./engine";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/scraper-engine.test.ts`
Expected: 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/scraper/engine.ts src/lib/scraper/index.ts tests/scraper-engine.test.ts
git commit -m "feat: add scrape engine with folder creation, design upsert, and index generation"
```

---

## Task 6: Scrape Scheduler

**Files:**
- Create: `src/lib/scraper/scheduler.ts`
- Modify: `src/instrumentation.ts`

- [ ] **Step 1: Write the scheduler**

Create `src/lib/scraper/scheduler.ts`:

```typescript
import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";

const activeTasks = new Map<string, ScheduledTask>();

/** Start or restart a cron job for a scrape target. */
export function registerTarget(target: { id: string; cronSchedule: string; name: string }): void {
  // Stop existing task if any
  unregisterTarget(target.id);

  if (!cron.validate(target.cronSchedule)) {
    console.error(`[Scraper] Invalid cron for "${target.name}": ${target.cronSchedule}`);
    return;
  }

  const task = cron.schedule(target.cronSchedule, async () => {
    console.log(`[Scraper] Starting scheduled scrape for "${target.name}"...`);
    const { runScrape } = await import("./engine");
    const result = await runScrape(target.id, "auto");
    console.log(`[Scraper] "${target.name}" completed: ${result.status} (${result.filesCreated} new, ${result.filesUpdated} updated)`);
  });

  activeTasks.set(target.id, task);
  console.log(`[Scraper] Registered "${target.name}" with cron: ${target.cronSchedule}`);
}

/** Stop a cron job for a target. */
export function unregisterTarget(targetId: string): void {
  const existing = activeTasks.get(targetId);
  if (existing) {
    existing.stop();
    activeTasks.delete(targetId);
  }
}

/** Load all enabled targets from DB and register their cron jobs. */
export async function startScrapeScheduler(): Promise<void> {
  const targets = await prisma.scrapeTarget.findMany({ where: { enabled: true } });
  for (const target of targets) {
    registerTarget(target);
  }
  if (targets.length > 0) {
    console.log(`[Scraper] Scheduler started with ${targets.length} target(s)`);
  }
}

/** Trigger an immediate scrape for a target (bypasses cron). */
export async function runScrapeNow(targetId: string): Promise<any> {
  const { runScrape } = await import("./engine");
  return runScrape(targetId, "manual");
}
```

- [ ] **Step 2: Update `src/instrumentation.ts`**

```typescript
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateBackupConfigFromEnv } = await import("@/lib/admin");
    await migrateBackupConfigFromEnv();

    const { startScheduler } = await import("@/lib/backup/scheduler");
    await startScheduler();

    const { startScrapeScheduler } = await import("@/lib/scraper/scheduler");
    await startScrapeScheduler();

    const { runSharedProjectsMigration } = await import("@/lib/migration");
    await runSharedProjectsMigration();
  }
}
```

- [ ] **Step 3: Update scraper index re-exports**

Add to `src/lib/scraper/index.ts`:

```typescript
export { GitHubScraper } from "./github";
export type { RepoInfo, TreeEntry } from "./github";
export { runScrape } from "./engine";
export { startScrapeScheduler, registerTarget, unregisterTarget, runScrapeNow } from "./scheduler";
```

- [ ] **Step 4: Verify build compiles**

Run: `npx next build 2>&1 | head -20`
Expected: Build starts without import errors (full build may fail on unrelated issues — check only for our file errors)

- [ ] **Step 5: Commit**

```bash
git add src/lib/scraper/scheduler.ts src/lib/scraper/index.ts src/instrumentation.ts
git commit -m "feat: add scrape scheduler with per-target cron registration"
```

---

## Task 7: Scraper API Routes

**Files:**
- Create: `src/app/api/admin/scraper/config/route.ts`
- Create: `src/app/api/admin/scraper/config/[id]/route.ts`
- Create: `src/app/api/admin/scraper/repos/route.ts`
- Create: `src/app/api/admin/scraper/branches/[repo]/route.ts`
- Create: `src/app/api/admin/scraper/run/route.ts`
- Create: `src/app/api/admin/scraper/history/route.ts`

- [ ] **Step 1: Create scraper config routes (GET all, POST new)**

Create `src/app/api/admin/scraper/config/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targets = await prisma.scrapeTarget.findMany({
    include: {
      repos: true,
      project: { select: { id: true, name: true } },
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(
    targets.map((t) => ({
      ...t,
      encryptedToken: undefined,
      tokenPreview: decrypt(t.encryptedToken).slice(0, 4) + "••••••••",
    }))
  );
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { name, githubType, githubName, apiUrl, token, cronSchedule, projectId } = body;

  if (!githubName || !token || !projectId) {
    return NextResponse.json(
      { error: "githubName, token, and projectId are required" },
      { status: 400 }
    );
  }

  const target = await prisma.scrapeTarget.create({
    data: {
      name: name || githubName,
      githubType: githubType || "org",
      githubName,
      apiUrl: (apiUrl || "https://api.github.com").replace(/\/+$/, ""),
      encryptedToken: encrypt(token),
      cronSchedule: cronSchedule || "0 */12 * * *",
      projectId,
    },
  });

  // Register with scheduler
  const { registerTarget } = await import("@/lib/scraper/scheduler");
  registerTarget(target);

  return NextResponse.json(target, { status: 201 });
}
```

- [ ] **Step 2: Create single target routes (PUT, DELETE)**

Create `src/app/api/admin/scraper/config/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, githubType, githubName, apiUrl, token, cronSchedule, enabled, projectId } = body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (githubType !== undefined) data.githubType = githubType;
  if (githubName !== undefined) data.githubName = githubName;
  if (apiUrl !== undefined) data.apiUrl = apiUrl.replace(/\/+$/, "");
  if (token) data.encryptedToken = encrypt(token);
  if (cronSchedule !== undefined) data.cronSchedule = cronSchedule;
  if (enabled !== undefined) data.enabled = enabled;
  if (projectId !== undefined) data.projectId = projectId;

  const updated = await prisma.scrapeTarget.update({ where: { id }, data });

  // Re-register with scheduler
  const { registerTarget, unregisterTarget } = await import("@/lib/scraper/scheduler");
  if (updated.enabled) {
    registerTarget(updated);
  } else {
    unregisterTarget(updated.id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { unregisterTarget } = await import("@/lib/scraper/scheduler");
  unregisterTarget(id);

  await prisma.scrapeTarget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create repos route (POST fetch from GitHub, PUT save selections)**

Create `src/app/api/admin/scraper/repos/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "@/lib/scraper/github";

/** POST: Fetch repos from GitHub for a target. */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { targetId } = body;

  const target = await prisma.scrapeTarget.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const token = decrypt(target.encryptedToken);
  const scraper = new GitHubScraper(target.apiUrl, token);

  const repos = [];
  for await (const page of scraper.listRepos(target.githubType as "org" | "user", target.githubName)) {
    repos.push(...page);
  }

  // Count markdown files per repo (quick tree scan)
  const reposWithCounts = [];
  for (const repo of repos) {
    const [owner, repoName] = repo.fullName.split("/");
    try {
      const sha = await scraper.getBranchSha(owner, repoName, repo.defaultBranch);
      let mdCount = 0;
      if (sha) {
        const tree = await scraper.getTreeRecursive(owner, repoName, sha);
        mdCount = tree.filter((e) => e.type === "blob" && e.path.endsWith(".md")).length;
      }
      reposWithCounts.push({ ...repo, mdFileCount: mdCount });
    } catch {
      reposWithCounts.push({ ...repo, mdFileCount: 0 });
    }
  }

  return NextResponse.json(reposWithCounts);
}

/** PUT: Save repo selections for a target. */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { targetId, repos } = body;
  // repos: Array<{ repoFullName, branch, defaultBranch, enabled }>

  if (!targetId || !Array.isArray(repos)) {
    return NextResponse.json({ error: "targetId and repos array required" }, { status: 400 });
  }

  // Delete existing repo configs for this target, then recreate
  await prisma.scrapeRepo.deleteMany({ where: { targetId } });

  for (const repo of repos) {
    await prisma.scrapeRepo.create({
      data: {
        targetId,
        repoFullName: repo.repoFullName,
        branch: repo.branch,
        defaultBranch: repo.defaultBranch,
        enabled: repo.enabled,
      },
    });
  }

  return NextResponse.json({ success: true, count: repos.length });
}
```

- [ ] **Step 4: Create branches route**

Create `src/app/api/admin/scraper/branches/[repo]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { GitHubScraper } from "@/lib/scraper/github";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ repo: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { repo: repoEncoded } = await params;
  const repoFullName = decodeURIComponent(repoEncoded);
  const [owner, repoName] = repoFullName.split("/");

  const targetId = request.nextUrl.searchParams.get("targetId");
  if (!targetId) {
    return NextResponse.json({ error: "targetId query param required" }, { status: 400 });
  }

  const target = await prisma.scrapeTarget.findUnique({ where: { id: targetId } });
  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  const token = decrypt(target.encryptedToken);
  const scraper = new GitHubScraper(target.apiUrl, token);
  const branches = await scraper.listBranches(owner, repoName);

  return NextResponse.json(branches);
}
```

- [ ] **Step 5: Create run and history routes**

Create `src/app/api/admin/scraper/run/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { runScrapeNow } from "@/lib/scraper/scheduler";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetId } = await request.json();
  if (!targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }

  const result = await runScrapeNow(targetId);
  return NextResponse.json(result);
}
```

Create `src/app/api/admin/scraper/history/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetId = request.nextUrl.searchParams.get("targetId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);

  const where = targetId ? { targetId } : {};
  const runs = await prisma.scrapeRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(runs);
}
```

- [ ] **Step 6: Verify routes compile**

Run: `npx next build 2>&1 | tail -5`
Expected: Build completes (or check no import errors from our new routes)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/scraper/
git commit -m "feat: add scraper API routes for config, repos, branches, run, and history"
```

---

## Task 8: Admin UI — Tabbed Layout with Backup and Scraper

**Files:**
- Modify: `src/app/admin/page.tsx` (full rewrite)

This is the largest task. The admin page gets a complete rewrite with two tabs: Backup and Scraper. Both use Tailwind dark mode classes throughout.

- [ ] **Step 1: Rewrite `src/app/admin/page.tsx`**

This is a large component. Write it as a full replacement. Key sections:
- Tab navigation (Backup | Scraper)
- **Backup tab**: editable config form, backup now button, restore button, history
- **Scraper tab**: multi-target tabs, config form per target, repo checklist with branch dropdowns, history per target, "Run Now" button

The full component code should:
- Use `"use client"` directive
- Use existing `Header` component
- Use `useSession` + admin check with redirect
- Use `apiUrl()` helper for all fetch calls
- Use `dark:` Tailwind classes on every element
- Include schedule presets dropdown with "Custom..." option
- Handle loading states, error states, and success feedback

Due to the size, implement this as the complete page component. Follow the existing patterns in the codebase (e.g., `useCallback` for fetch functions, `useState` for form state).

- [ ] **Step 2: Test manually in the browser**

1. Log in as the admin user (`demo` / `demo123`)
2. Navigate to `/admin`
3. Verify Backup tab shows editable config form
4. Verify Scraper tab shows target management
5. Verify dark mode toggle works on both tabs

- [ ] **Step 3: Run lint on the new file**

Run: `npx eslint src/app/admin/page.tsx`
Expected: No errors (warnings about `any` types are acceptable for v1)

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: rewrite admin page with tabbed Backup and Scraper UI"
```

---

## Task 9: Integration Test & Final Verification

**Files:**
- No new files — verification only

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass (the 2 pre-existing export test failures are unrelated)

- [ ] **Step 2: Run lint**

Run: `npx eslint src/lib/crypto.ts src/lib/admin.ts src/lib/scraper/ src/app/api/admin/`
Expected: Clean (no errors)

- [ ] **Step 3: Test the full flow manually**

1. Start dev server: `npm run dev`
2. Log in as `demo` / `demo123`
3. Go to `/admin` → Scraper tab
4. Add a new scrape target (use a public GitHub org/user)
5. Click "Fetch Repos" → verify repo checklist populates
6. Select repos, choose branches
7. Click "Run Now" → verify scrape completes
8. Navigate to the target project → verify `scrapedata/` folder with Index and repo folders
9. Run again → verify updates (not duplicates)

- [ ] **Step 4: Verify backup config migration**

1. If you have `GITHUB_BACKUP_*` env vars set, verify they were migrated to DB on startup
2. Check admin Backup tab shows the migrated config as editable
3. Test "Backup Now" still works

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete GitHub markdown scraper with admin UI and backup migration"
```
