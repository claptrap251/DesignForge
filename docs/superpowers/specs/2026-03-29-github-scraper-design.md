# GitHub Org/User Markdown Scraper — Design Spec

## Overview

Add the ability to scrape all markdown files from GitHub organizations or user accounts, import them into DesignForge, and organize them by project. Admin-configured, cron-scheduled, with manual trigger support. Additionally, migrate the existing backup configuration from environment variables to the database for consistency.

## Goals

1. Scrape `.md` files from selected repos/branches of a GitHub org or user
2. Import scraped content as read-only MARKDOWN designs in DesignForge
3. Auto-generate a compact index for AI agent context lookup
4. Support multiple scrape targets, each mapped to a different project
5. Migrate backup config from env vars to DB (shared encrypted token pattern)
6. Admin-only — no user-facing scrape actions

## Architecture

**Approach:** Inline in Next.js via `node-cron`, matching the existing backup scheduler pattern. No separate worker process. Scraper logic runs server-side within the Next.js process.

**New modules:**

```
src/lib/
├── crypto.ts                 ← Shared AES-256-GCM encrypt/decrypt (used by both scraper and backup)
└── scraper/
    ├── github.ts             ← GitHubScraper client (multi-repo, read-only)
    ├── engine.ts             ← Orchestrator: runs a full scrape for a target
    ├── scheduler.ts          ← node-cron registration for all active targets
    └── index.ts              ← Public API re-exports
```

**Why a new GitHubScraper client instead of extending the existing one:** The backup client (`src/lib/backup/github.ts`) is built around a single repo with push operations. The scraper needs multi-repo read-only operations (list org repos, enumerate branches, walk trees). Sharing code would create awkward abstractions.

## Data Model

### New Prisma Models

```prisma
model BackupConfig {
  id             String   @id @default(cuid())
  apiUrl         String   @default("https://api.github.com")
  repo           String   // "owner/repo"
  encryptedToken String   // AES-256-GCM encrypted
  branch         String   @default("main")
  cronSchedule   String   @default("0 2 * * *")
  enabled        Boolean  @default(true)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model ScrapeTarget {
  id             String       @id @default(cuid())
  name           String       // display name
  githubType     String       // "org" or "user"
  githubName     String       // org or username
  apiUrl         String       @default("https://api.github.com")
  encryptedToken String       // AES-256-GCM encrypted
  cronSchedule   String       @default("0 */12 * * *")
  enabled        Boolean      @default(true)
  projectId      String       // target DesignForge project
  project        Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  repos          ScrapeRepo[]
  runs           ScrapeRun[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt
}

model ScrapeRepo {
  id             String       @id @default(cuid())
  targetId       String
  target         ScrapeTarget @relation(fields: [targetId], references: [id], onDelete: Cascade)
  repoFullName   String       // "org/repo-name"
  branch         String       // selected branch
  defaultBranch  String       // repo's default branch (fallback)
  enabled        Boolean      @default(true)
  createdAt      DateTime     @default(now())
}

model ScrapeRun {
  id             String       @id @default(cuid())
  targetId       String
  target         ScrapeTarget @relation(fields: [targetId], references: [id], onDelete: Cascade)
  trigger        String       // "auto" or "manual"
  status         String       // "running", "success", "partial", "failed"
  filesFound     Int          @default(0)
  filesUpdated   Int          @default(0)
  filesCreated   Int          @default(0)
  reposScraped   Int          @default(0)
  reposSkipped   Int          @default(0)
  error          String?
  log            String?      // JSON array of log entries
  startedAt      DateTime     @default(now())
  completedAt    DateTime?
}
```

### Schema Changes to Existing Models

- `Project` gains a `scrapeTargets ScrapeTarget[]` relation (one project can have multiple scrape targets)
- `BackupConfig` is a **singleton** — one row for the whole app, not per-project. No relation to Project needed.

## Token Encryption

**Module:** `src/lib/crypto.ts`

```typescript
encrypt(plaintext: string): string   // AES-256-GCM → base64(iv + ciphertext + authTag)
decrypt(ciphertext: string): string  // base64 → plaintext
```

- Encryption key: `ENCRYPTION_KEY` env var, falls back to `NEXTAUTH_SECRET`
- Algorithm: AES-256-GCM with random 12-byte IV per encryption
- Key derivation: SHA-256 hash of the env var to get a 32-byte key
- The env var is the only thing needed to decrypt the database — portable across machines

## Folder Structure & Content Mapping

Scraped content creates this hierarchy inside the target project:

```
Project (e.g., "E-Commerce Platform")
└── scrapedata/                      ← root folder, ownerUsername: null
    ├── Index                        ← Single index design (auto-generated)
    ├── claude-code/
    │   ├── README
    │   ├── docs/
    │   │   ├── getting-started
    │   │   └── api-reference
    │   └── guides/
    │       └── quickstart
    └── another-repo/
        └── ...
```

### Rules

- **Root folder** named `scrapedata`, `ownerUsername: null` — no owner, read-only
- **Repo folders** directly under `scrapedata/`
- **Path folders** mirror GitHub directory structure
- **Designs** created as `type: "MARKDOWN"`, `status: "DRAFT"`, name = filename without `.md`
- **On re-scrape:** existing designs updated in-place (content overwritten, `updatedAt` bumped). No version increment — these are synced snapshots.
- **New files** on GitHub → new Design records
- **Ownership:** `ownerUsername: null` throughout. Anyone can view and comment. Nobody can edit (content is overwritten on next scrape anyway).
- **Root folder constraint bypass:** The existing API blocks uploads to user-root folders, but the scraper writes directly via Prisma (not through the API route), so this constraint does not apply. Designs can live at any folder level in the scraped tree.

### Index Design

A single auto-generated `Index` markdown design at the `scrapedata/` level. Compact format optimized for AI agent context:

```markdown
# Scraped Markdown Index

> Last synced 2026-03-29 12:00 UTC | Source: anthropic | 2 repos, 6 files

claude-code: README.md, docs/getting-started.md, docs/api-reference.md, guides/quickstart.md
another-repo: CHANGELOG.md, docs/setup.md
```

**Purpose:** When a user creates a new markdown file and the similarity engine flags related scraped docs, an AI agent reads this index to quickly identify which repo a related file belongs to — minimal tokens, maximum context.

Regenerated on every scrape run.

## Scrape Execution Flow

1. Scheduler fires (or admin clicks "Run Now")
2. Create `ScrapeRun` record with status `"running"`
3. Decrypt token from `ScrapeTarget`
4. For each enabled `ScrapeRepo`:
   a. Fetch branch SHA — if branch deleted, fall back to `defaultBranch`, log warning
   b. Get recursive tree (`?recursive=1`), filter for `*.md` files
   c. For each `.md` file: fetch raw content via blob API
   d. Create/update folder hierarchy + Design records in Prisma
   e. Track stats (created, updated, skipped)
5. Regenerate the Index design
6. Update `ScrapeRun` with final stats and status

### Error Isolation

- One repo failing does not abort the whole run — skip it, log the error, continue
- Status is `"success"` (all repos), `"partial"` (some repos skipped), or `"failed"` (all repos failed or fatal error)
- Token auth failure on a repo → skip + log "no access"

### Rate Limit Handling

- Read `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers after each API call
- When remaining < 10, pause until reset time
- Log rate limit pauses in the run log

## API Routes

### New Scraper Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/scraper/config` | GET | Get all scrape targets (tokens masked) |
| `/api/admin/scraper/config` | POST | Create new scrape target |
| `/api/admin/scraper/config/[id]` | PUT | Update scrape target |
| `/api/admin/scraper/config/[id]` | DELETE | Delete scrape target (+ optionally scraped data) |
| `/api/admin/scraper/repos` | POST | Fetch repos from GitHub for a target (body: targetId or ad-hoc apiUrl+token+name) |
| `/api/admin/scraper/repos` | PUT | Save repo selections (enabled, branch) |
| `/api/admin/scraper/branches/[repo]` | GET | Fetch branches for a specific repo (lazy-loaded) |
| `/api/admin/scraper/run` | POST | Trigger immediate scrape (body: targetId) |
| `/api/admin/scraper/history` | GET | Get scrape runs (query: targetId, limit) |

### Updated Backup Routes

| Route | Method | Change |
|-------|--------|--------|
| `/api/admin/config` | GET | Read from `BackupConfig` DB table instead of env vars |
| `/api/admin/config` | POST | **New** — create/update backup config in DB |

All routes use existing `auth()` + `isAdmin()` checks.

## GitHubScraper Client

**Module:** `src/lib/scraper/github.ts`

```typescript
class GitHubScraper {
  constructor(apiUrl: string, token: string)

  // Org/user operations
  listRepos(type: "org" | "user", name: string): AsyncGenerator<Repo[]>  // paginated
  listBranches(owner: string, repo: string): Promise<Branch[]>

  // Tree operations
  getDefaultBranch(owner: string, repo: string): Promise<string>
  getBranchSha(owner: string, repo: string, branch: string): Promise<string | null>
  getTreeRecursive(owner: string, repo: string, sha: string): Promise<TreeEntry[]>

  // Content
  getBlobContent(owner: string, repo: string, sha: string): Promise<string>

  // Rate limit
  getRateLimit(): { remaining: number; reset: Date }
}
```

Uses `AsyncGenerator` for repo listing to handle pagination naturally. Rate limit state tracked per-instance.

## Admin UI

### Layout

Two tabs on the admin page:
1. **Backup** — editable config form (migrated from env vars)
2. **GitHub Scraper** — multi-target management

### Backup Tab

- Editable form: API URL, repo, branch, encrypted token, schedule
- Save, Backup Now, Restore buttons
- Backup history list

### Scraper Tab

- **Target tabs** at top: switch between configured targets, "+ Add Target" button
- **Config panel per target:** API URL, type (org/user), GitHub name, token, project dropdown, schedule dropdown, save/fetch repos buttons, delete button
- **Repo checklist:** select all/deselect all, per-repo checkbox + branch dropdown, `.md` file count preview
- **History table per target:** timestamp, trigger (auto/manual badge), result, file counts
- **"Run Now" button** per target

### Schedule Presets

Dropdown with: Every hour, Every 6 hours, Every 12 hours (default), Daily at 2 AM, Weekly (Sunday), Custom (reveals raw cron input).

### Dark Mode

All UI uses existing Tailwind dark mode classes (`dark:bg-*`, `dark:text-*`, `dark:border-*`) and `ThemeProvider`. No separate styling.

### GitHub Enterprise Support

API URL field on both backup and scraper configs. Defaults to `https://api.github.com`. Accepts enterprise URLs like `https://github.mycompany.com/api/v3`.

## Backup Config Migration

On server startup (in `instrumentation.ts`):
1. Check if `BackupConfig` table has any rows
2. If no rows AND `GITHUB_BACKUP_*` env vars exist:
   - Create a `BackupConfig` row from env var values
   - Encrypt the token
   - Log: `[Migration] Backup config migrated from env vars to database`
3. After migration, env vars are ignored for backup config
4. Existing backup scheduler reads from DB instead of `getBackupConfig()`

## Scheduler Changes

**`src/instrumentation.ts`** on startup:
1. Run backup config migration (env → DB)
2. Load `BackupConfig` from DB → register cron job if enabled
3. Load all enabled `ScrapeTarget` records → register cron job for each
4. Log registered schedules

**`src/lib/scraper/scheduler.ts`:**
- `startScrapeScheduler()` — loads targets, registers cron jobs
- `registerTarget(target)` — registers/updates a single target's cron
- `unregisterTarget(targetId)` — stops a target's cron
- `runScrapeNow(targetId)` — immediate trigger

## Out of Scope (v1)

- Per-user scraping (admin-only)
- Webhook-based real-time sync (cron is fine)
- Non-markdown file types
- Git history or blame
- Deleted file detection/cleanup on GitHub
- Scrape conflict resolution (overwrite is the strategy)
