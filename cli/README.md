# dfcli — DesignForge CLI

## What is dfcli

dfcli is a command-line tool for AI coding agents (and human developers) to load context from a DesignForge instance. It pulls markdown files and their linked dependencies, uploads generated documentation back into a project, and discovers related content across projects using semantic similarity — including files scraped from external GitHub repositories. Agents can use dfcli to ground themselves in the relevant design specs, API docs, and prior art before writing code.

---

## Installation

```bash
npx dfcli
# or install globally
npm i -g dfcli
```

---

## Quick Start

1. Point dfcli at your DesignForge instance:
   ```bash
   export DFCLI_URL=http://localhost:3000
   ```
2. Set an API token (optional for read-only commands):
   ```bash
   export DFCLI_TOKEN=<your-token>
   ```
3. Find docs related to what you are working on:
   ```bash
   dfcli related ./my-doc.md --project "My Project"
   ```

---

## Authentication Setup

Tokens are required for write operations (`upload`, and `related` with auto-upload).

1. Log in to DesignForge in your browser.
2. Open the user menu (top-right corner) and click **API Tokens**.
3. Click **Generate Token** and enter a descriptive name.
4. Copy the token — it is shown only once.
5. Export it in your shell:
   ```bash
   export DFCLI_TOKEN=<token>
   ```

---

## Configuration

### Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DFCLI_URL` | Yes | `http://localhost:3000` | URL of the DesignForge instance |
| `DFCLI_TOKEN` | No | — | API token; required for write operations |

### Global flags

These flags apply to every command and override the corresponding environment variable:

| Flag | Description |
|------|-------------|
| `--base-url <url>` | DesignForge instance URL |
| `--token <token>` | API token |
| `--verbose` | Print debug information to stderr |
| `--help` | Show help for any command |

---

## Commands

### `dfcli pull`

Fetch a markdown file from DesignForge. By default, dfcli also fetches every file linked from that document, and every file linked from those files, up to a configurable depth.

**Syntax**

```
dfcli pull <path> --project <name|id> [options]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<path>` | Path to the file within the project. Use `folder/subfolder/name` format — no `.md` extension. |

**Options**

| Option | Default | Description |
|--------|---------|-------------|
| `--project <name\|id>` | — | Project name or ID (required) |
| `--depth <n>` | `3` | Maximum link-traversal depth. Use `0` to fetch only the requested file. |
| `--format <text\|json>` | `text` | Output format |

**Examples**

Fetch a file and up to 1 level of linked files:
```bash
dfcli pull "demo/Designs/Login Screen Spec" --project "Mobile App" --depth 1
```

Text output:
```
--- FILE: demo/Designs/Login Screen Spec ---
# Login Screen Spec
...

--- FILE: demo/Designs/Auth Flow ---
# Auth Flow
...
```

JSON output (`--format json`):
```json
{
  "files": [
    {
      "path": "demo/Designs/Login Screen Spec",
      "content": "# Login Screen Spec\n..."
    },
    {
      "path": "demo/Designs/Auth Flow",
      "content": "# Auth Flow\n..."
    }
  ]
}
```

Fetch only the requested file (no traversal):
```bash
dfcli pull "specs/API Reference" --project "Backend" --depth 0 --format json
```

---

### `dfcli upload`

Upload one or more local markdown files into a DesignForge project. Requires authentication.

**Syntax**

```
dfcli upload <files...> --project <name|id> [options]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<files...>` | One or more file paths. Glob patterns (e.g. `./specs/*.md`) are supported. |

**Options**

| Option | Default | Description |
|--------|---------|-------------|
| `--project <name\|id>` | — | Project name or ID (required) |
| `--dest <path>` | `""` (project root) | Destination folder path inside the project |
| `--overwrite` | `false` | Create a new version if a file with the same name already exists |
| `--format <text\|json>` | `text` | Output format |

**Examples**

Upload a directory of spec files into a `specs` folder:
```bash
dfcli upload ./specs/*.md --project "Mobile App" --dest specs --overwrite
```

Text output:
```
created  ./specs/login.md → specs/login
updated  ./specs/profile.md → specs/profile
```

JSON output (`--format json`):
```json
{
  "uploaded": [
    { "localPath": "./specs/login.md", "remotePath": "specs/login", "status": "created" },
    { "localPath": "./specs/profile.md", "remotePath": "specs/profile", "status": "updated" }
  ]
}
```

Upload a single file to the project root:
```bash
dfcli upload ./ARCHITECTURE.md --project "Backend"
```

---

### `dfcli related`

Find files in DesignForge that are semantically similar to a given file. The input can be a local file path or a remote path inside DesignForge. When authenticated, dfcli automatically uploads the local file before searching so the result is indexed for future use — suppress this with `--no-upload`.

**Syntax**

```
dfcli related <file> --project <name|id> [options]
```

**Arguments**

| Argument | Description |
|----------|-------------|
| `<file>` | Local file path or remote path within the project |

**Options**

| Option | Default | Description |
|--------|---------|-------------|
| `--project <name\|id>` | — | Project name or ID (required) |
| `--source <scraped\|user\|all>` | `all` | Filter results by content source |
| `--repo <name>` | — | Filter scraped results to a specific GitHub repo |
| `--min-score <n>` | `0.3` | Minimum similarity score (0.0–1.0) |
| `--limit <n>` | `10` | Maximum number of results |
| `--include-content` | `false` | Include full file contents in output |
| `--no-upload` | — | Skip auto-upload even when a token is set |
| `--format <text\|json>` | `text` | Output format |

**Examples**

Find auth-related docs from a scraped GitHub repo:
```bash
dfcli related ./login-redesign.md \
  --project "Mobile App" \
  --source scraped \
  --repo phoneapp \
  --include-content
```

Text output:
```
Uploaded: Mobile App/login-redesign (created)

0.87  scraped/phoneapp/docs/auth-overview
0.74  scraped/phoneapp/docs/session-management
0.61  Mobile App/specs/Login Screen Spec

--- FILE: scraped/phoneapp/docs/auth-overview ---
# Auth Overview
...
```

JSON output (`--format json`):
```json
{
  "query": "login-redesign.md",
  "uploaded": { "path": "Mobile App/login-redesign", "status": "created" },
  "related": [
    { "path": "scraped/phoneapp/docs/auth-overview", "score": 0.87, "content": "# Auth Overview\n..." },
    { "path": "scraped/phoneapp/docs/session-management", "score": 0.74 }
  ]
}
```

Search without uploading (read-only):
```bash
dfcli related ./login-redesign.md --project "Mobile App" --no-upload
```

---

## Auth Modes

| Command | Auth Required? | Behavior |
|---------|---------------|----------|
| `pull` | No | Read-only file fetch |
| `upload` | Yes | Upload files to project |
| `related` (no token) | No | Read-only similarity search; file is not uploaded |
| `related` (with token) | — | Auto-uploads the local file, then searches |
| `related --no-upload` | No | Similarity search only, even when a token is set |

---

## Workflow Examples

### Agent context loading

An agent working on a login feature can load the relevant design specs and find related auth documentation from scraped GitHub repos before writing any code:

```bash
# Find docs related to the current work-in-progress file
dfcli related ./src/features/auth/login.md \
  --project "Mobile App" \
  --source scraped \
  --min-score 0.5 \
  --include-content

# Pull the most relevant spec and everything it links to
dfcli pull "Mobile App/specs/Auth Flow" --project "Mobile App" --depth 2
```

### Bulk upload specs

Upload an entire directory of generated specs into a dedicated folder:

```bash
dfcli upload ./generated-specs/*.md \
  --project "Backend" \
  --dest generated \
  --overwrite \
  --format json
```

### Link traversal

Pull a top-level document and recursively resolve every file it references:

```bash
# Depth 0 = just the file; depth 3 (default) = file + all linked files up to 3 hops
dfcli pull "docs/Architecture Overview" --project "Backend" --depth 3
```

### Searching scraped GitHub docs

Find docs from a specific GitHub org/repo without uploading anything:

```bash
dfcli related ./my-feature-spec.md \
  --project "Mobile App" \
  --source scraped \
  --repo phoneapp \
  --no-upload \
  --limit 5
```

---

## Output Formats

Every command supports `--format text` (default) and `--format json`.

**Text** — human-readable, streamed to stdout. Informational messages (e.g. "Uploaded: …", "No related files found.") go to stderr so they can be suppressed without affecting piped output.

**JSON** — machine-readable, emitted as a single JSON object on stdout. Useful when piping dfcli output into another tool or script.

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error (upload conflict, network error, etc.) |
| 2 | Authentication error (missing or invalid token) |
| 3 | Not found (project name, file path) |

---

## Troubleshooting

**"Authentication required"**
A token is required for this operation. Set `DFCLI_TOKEN` or pass `--token <token>`.

**"Project not found"**
The value passed to `--project` did not match any project name or ID. Project names are case-insensitive but must otherwise be exact. Verify the project exists in DesignForge.

**"Connection refused"**
dfcli cannot reach the DesignForge server. Check that `DFCLI_URL` points to the correct host and port and that the server is running.

**"File not found"**
The path you supplied does not exist in the project. Use the format `folder/subfolder/name` — do not include a `.md` extension. Paths are case-sensitive.

**Glob patterns not expanding**
Shell glob expansion may have already occurred before dfcli sees the argument. Quote the pattern to let dfcli handle it: `dfcli upload './specs/*.md' --project "My Project"`.
