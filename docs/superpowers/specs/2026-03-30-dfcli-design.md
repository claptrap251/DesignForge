# dfcli — DesignForge CLI for AI Agent Context Loading

## Overview

A standalone CLI tool that AI coding agents (Claude Code skills, Windsurf/Cascade, etc.) invoke to pull, upload, and discover related markdown files from DesignForge. The primary use case is **context loading**: an agent working on a feature uses `dfcli` to find and fetch relevant design docs, specs, and scraped GitHub documentation — keeping the agent's context window rich and focused.

## Goals

1. Machine-consumable CLI — no interactive prompts, structured output, clear exit codes
2. Two-way sync — agents pull context and contribute docs back automatically
3. Seamless scraped content discovery — agents find related docs from GitHub repos alongside user-authored designs
4. Progressive auth — read-only access without credentials, write access with API tokens
5. Minimal footprint — single `npx`-runnable package, one runtime dependency (`commander`)

## Example Workflow

```
# Agent is working on a login feature for "phoneapp" repo
# It has a local design doc: ./login-redesign.md

# 1. Find related docs (auto-uploads the file + returns related content)
dfcli related ./login-redesign.md --project "Mobile App" --source scraped --repo phoneapp --include-content

# Returns: auth-best-practices.md (0.87), biometric-integration.md (0.72), session-security.md (0.65)
# Agent loads these into context window

# 2. Later, agent wants to read a specific linked doc
dfcli pull scrapedata/phoneapp/auth-best-practices --project "Mobile App" --depth 1

# Returns the file + any docs it links to
```

## Commands

### `dfcli pull <path> [options]`

Fetch a markdown file from DesignForge and follow its links.

```
Options:
  --project <name|id>    Project scope (required)
  --depth <n>            Max link traversal depth (default: 3)
  --format <text|json>   Output format (default: text)
```

- Fetches the target file by path within the project.
- Parses markdown for links to other files:
  - Standard links: `[text](./other.md)`, `[text](/path/to/doc.md)`
  - Wiki-style links: `[[other-doc]]`, `[[folder/other-doc]]`
  - Only `.md` / `.markdown` links followed. URLs, images, anchors ignored.
- Recursively follows links up to `--depth`. Tracks visited files to avoid cycles.
- `--depth 0` returns only the target file.
- Missing linked files silently skipped (logged with `--verbose`).
- Auth: **Not required** (read-only).

**Text output:**
```
--- FILE: demo/Designs/login-redesign.md ---
<contents>

--- FILE: demo/Designs/auth-flow.md ---
<contents>
```

**JSON output:**
```json
{
  "files": [
    { "path": "demo/Designs/login-redesign.md", "content": "..." },
    { "path": "demo/Designs/auth-flow.md", "content": "..." }
  ]
}
```

### `dfcli upload <file-or-glob> [options]`

Upload markdown files to a project.

```
Options:
  --project <name|id>    Project scope (required)
  --dest <folder-path>   Destination folder path (default: user's root folder)
  --overwrite            Overwrite / create new version if exists (default: false)
  --format <text|json>   Output format (default: text)
```

- Accepts one or more files (supports glob: `docs/*.md`).
- If file already exists at destination and `--overwrite` is set, creates a new version.
- If file exists and `--overwrite` is not set, fails with error to stderr.
- Auth: **Required**.

**JSON output:**
```json
{
  "uploaded": [
    { "localPath": "docs/spec.md", "remotePath": "demo/specs/spec.md", "status": "created" },
    { "localPath": "docs/auth.md", "remotePath": "demo/specs/auth.md", "status": "versioned" }
  ]
}
```

### `dfcli related <local-file-or-remote-path> [options]`

Find related markdown files by similarity. The **primary workflow command**.

```
Options:
  --project <name|id>    Project scope (required)
  --source <scraped|user|all>  Filter by content source (default: all)
  --repo <repo-name>     Filter to a specific scraped repo
  --min-score <0.0-1.0>  Minimum relevance threshold (default: 0.3)
  --limit <n>            Max results (default: 10)
  --include-content      Include file contents in output (default: false)
  --no-upload            Skip auto-upload even if authenticated
  --format <text|json>   Output format (default: text)
```

**Behavior depends on auth state:**

| Auth | Upload | Search |
|------|--------|--------|
| No token | Skip | Read-only similarity search |
| Token set | Auto-upload to user's folder (create or version) | Search after upload |
| Token + `--no-upload` | Skip | Read-only search |

- If argument is a local file (exists on disk): reads content, sends to API.
- If argument is a remote path (in DesignForge): uses that file directly.
- Uses the existing TF-IDF similarity engine (`computeRelationships`).
- `--source scraped` filters to designs under `scrapedata/` folders.
- `--repo phoneapp` further filters to a specific repo subfolder.

**Text output:**
```
0.87  scrapedata/phoneapp/auth-best-practices.md
0.72  scrapedata/phoneapp/biometric-integration.md
0.45  demo/Designs/session-management.md
```

**JSON output:**
```json
{
  "query": "login-redesign.md",
  "uploaded": { "remotePath": "demo/Designs/login-redesign.md", "status": "created" },
  "related": [
    { "path": "scrapedata/phoneapp/auth-best-practices.md", "score": 0.87, "content": "..." },
    { "path": "scrapedata/phoneapp/biometric-integration.md", "score": 0.72, "content": "..." }
  ]
}
```

## Global Options

```
Global Options:
  --base-url <url>       DesignForge instance URL (default: env DFCLI_URL)
  --token <token>        API token (default: env DFCLI_TOKEN)
  --verbose              Print debug info to stderr
  --help                 Show help
```

## Authentication

### API Tokens

New Prisma model:

```prisma
model ApiToken {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash    String    @unique   // SHA-256 hash of the plaintext token
  name         String    @default("CLI Token")
  lastUsedAt   DateTime?
  createdAt    DateTime  @default(now())
}
```

**Token lifecycle:**
- User goes to `/settings/tokens` → clicks "Generate Token"
- Server generates a random 32-byte token, stores SHA-256 hash in DB, returns plaintext **once**
- User copies token, sets `DFCLI_TOKEN=<token>` in their environment
- CLI sends `Authorization: Bearer <token>` on requests
- Server hashes the incoming token, looks up `ApiToken`, returns associated user
- Multiple tokens per user (e.g., "laptop", "CI", "windsurf")
- Tokens stay valid until explicitly deleted — no expiry for v1
- Lost token → generate new one, delete old one. No recovery (only hash stored).

**Auth priority in `apiAuth.ts`:**
1. Bearer token (new) → look up `ApiToken` by hash
2. Basic Auth (existing) → username:password
3. Session (existing) → next-auth session

### Token Management UI

New page at `/settings/tokens`:
- List of user's tokens: name, created date, last used date, delete button
- "Generate Token" button → name input → shows token once with copy button + warning
- Delete with confirmation
- Accessible from header user menu → "API Tokens"
- Any user can manage their own tokens (not admin-only)

## CLI Structure

```
cli/
├── package.json          ← name: "dfcli", bin: { "dfcli": "./dist/index.js" }
├── tsconfig.json
├── README.md             ← Full documentation
└── src/
    ├── index.ts          ← Entry point, commander setup, global options
    ├── client.ts         ← HTTP client (Bearer auth, base URL, request/retry helper)
    ├── commands/
    │   ├── pull.ts       ← pull command + link parsing + traversal
    │   ├── upload.ts     ← upload command + glob expansion
    │   └── related.ts    ← related command + source/repo filtering
    └── utils.ts          ← Output formatting (text/json), path normalization
```

**Dependencies:** `commander` (only runtime dep). TypeScript compiled to JS for distribution.

**Packaging:** `npx dfcli` or `npm i -g dfcli`.

## Server-Side API Endpoints

### New CLI endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `GET /api/cli/files` | GET | Optional | Get file content by project + path (`?project=X&path=Y`) |
| `POST /api/cli/files` | POST | Required | Upload/version a markdown file |
| `POST /api/cli/related` | POST | Optional | Send content, get related docs with similarity scores |
| `GET /api/cli/projects` | GET | Optional | List projects (id + name) |

### Token management endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `POST /api/tokens` | POST | Session | Generate new token (returns plaintext once) |
| `GET /api/tokens` | GET | Session | List user's tokens (metadata only, no hashes) |
| `DELETE /api/tokens/[id]` | DELETE | Session | Revoke a token |

### CLI endpoint details

**`GET /api/cli/files`**
- Query: `project` (name or id), `path` (folder path within project, e.g., `demo/Designs/login.md`)
- Walks folder tree to find the design by path
- Returns: `{ path, name, content, folderId, folderPath }`

**`POST /api/cli/files`**
- Body: `{ projectId, destPath, name, content, overwrite? }`
- Creates folder hierarchy if needed (like the scraper's `ensureFolder`)
- If design exists at path: creates new version if `overwrite`, else 409 Conflict
- If new: creates design in user's folder under `destPath`
- Returns: `{ path, status: "created" | "versioned", designId }`

**`POST /api/cli/related`**
- Body: `{ projectId, content, source?, repo?, minScore?, limit?, includeContent?, upload?: { name, destPath }? }`
- If `upload` present and authenticated: upsert the file first, then compute similarity
- Runs `computeRelationships()` on all markdown designs in the project
- Filters results by `source` (scraped folders vs user folders) and `repo`
- Returns: `{ uploaded?: { path, status }, related: [{ path, score, content? }] }`

**`GET /api/cli/projects`**
- Returns: `[{ id, name, description }]`
- Lightweight — no folder/design tree, just project metadata

## Link Resolution (pull command)

All client-side in the CLI:

1. Fetch target file via `GET /api/cli/files`
2. Parse content for markdown links using regex:
   - `\[([^\]]+)\]\(([^)]+\.(?:md|markdown))\)` — standard links
   - `\[\[([^\]]+)\]\]` — wiki-style links
3. Resolve relative paths against current file's directory
4. Normalize paths (deduplicate `./foo.md` and `foo.md`)
5. For each unvisited link within depth limit: fetch and repeat
6. Collect all files, output in requested format

## Output & Error Handling

- **stdout**: Data only (file contents, JSON responses)
- **stderr**: Errors, warnings, verbose debug info
- **No color codes** unless stdout is a TTY (prefer plain always for machine use)
- **No interactive prompts** — fail with clear error instead

**Exit codes:**
| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Auth error (no token, invalid token) |
| 3 | Not found (project, file) |

**Network resilience:**
- Retry once on network failure before failing
- Respect rate limit headers if present (back off and retry)

## README Contents

The `cli/README.md` must include:
1. **What is dfcli** — one-paragraph description
2. **Installation** — `npx dfcli` or `npm i -g dfcli`
3. **Authentication setup** — how to generate a token at `/settings/tokens`, set `DFCLI_TOKEN`
4. **Configuration** — env vars (`DFCLI_URL`, `DFCLI_TOKEN`), global flags
5. **Commands** — full reference for `pull`, `upload`, `related` with all options
6. **Auth modes** — table showing what works with/without auth
7. **Workflow examples** — the agent context loading scenario, bulk upload, link traversal
8. **Output formats** — text and JSON examples for each command
9. **Exit codes** — table
10. **Troubleshooting** — common errors and fixes

## Schema Changes

- Add `ApiToken` model (see Authentication section)
- Add `tokens ApiToken[]` relation to `User` model

## Out of Scope (v1)

- Token expiry / rotation policies
- File deletion via CLI
- Caching of fetched files
- Watch / live mode
- Non-markdown file types
- Admin oversight of other users' tokens
- Webhook integration for real-time sync
