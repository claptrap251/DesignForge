---
name: designforge
description: Fetch related design docs, specs, and scraped GitHub documentation from DesignForge to fill context gaps. Use when working on any feature, bug fix, or design — automatically finds relevant existing documents and loads them into context.
---

# DesignForge Context Loader

You have access to DesignForge — a design review platform that stores markdown documents organized by project, including documentation scraped from GitHub repos. Use `dfcli` to pull relevant context before writing code or designs.

## When to Use

**ALWAYS use this skill when:**
- Starting work on a new feature or bug fix
- Writing or reviewing a design document
- You need to understand existing patterns, specs, or decisions
- You see references to designs, specs, or documentation that might exist in DesignForge
- You want to check if related work has already been documented

**Do NOT use when:**
- The task is purely mechanical (renaming, formatting)
- You already have all needed context in the conversation

## Setup

The skill requires `dfcli` to be built. If `cli/dist/index.js` doesn't exist, build it first:

```bash
cd cli && npm install && npm run build && cd ..
```

Environment variables (set these or pass as flags):
- `DFCLI_URL` — DesignForge instance URL (default: `http://localhost:3000`)
- `DFCLI_TOKEN` — API token for write access (optional for read-only queries)

Generate a token at `<DFCLI_URL>/settings/tokens` if you need write access.

## The Process

### Step 1: Identify What You're Working On

Before querying DesignForge, determine:
- What feature/component/area is the current task about?
- Is there a local file (spec, design doc, code file) that represents the work?
- Which DesignForge project is most relevant?

### Step 2: Find Related Documents

**If you have a local markdown file** (design doc, spec, README):

```bash
node cli/dist/index.js related <local-file> \
  --project "<project-name>" \
  --include-content \
  --format json \
  --no-upload
```

**If you want to search scraped GitHub docs specifically:**

```bash
node cli/dist/index.js related <local-file> \
  --project "<project-name>" \
  --source scraped \
  --include-content \
  --format json \
  --no-upload
```

**If you want to filter to a specific repo:**

```bash
node cli/dist/index.js related <local-file> \
  --project "<project-name>" \
  --source scraped \
  --repo <repo-name> \
  --include-content \
  --format json \
  --no-upload
```

**If you don't have a local file**, create a temporary one with the key terms/description of what you're working on:

```bash
echo "# <topic>\n\n<brief description of what you're working on, key terms, components involved>" > /tmp/dfcli-query.md
node cli/dist/index.js related /tmp/dfcli-query.md \
  --project "<project-name>" \
  --include-content \
  --format json \
  --no-upload
```

### Step 3: Pull the Scrape Index (Optional)

To see what scraped repos and files are available:

```bash
node cli/dist/index.js pull "scrapedata/Index" \
  --project "<project-name>" \
  --depth 0 \
  --format json
```

This returns the compact index showing `repo: file1, file2, ...` for all scraped content.

### Step 4: Pull Specific Files

If you found a relevant file and need its full content:

```bash
node cli/dist/index.js pull "<folder/path/filename>" \
  --project "<project-name>" \
  --depth 1 \
  --format json
```

Use `--depth 1` to also fetch files it links to, or `--depth 0` for just that file.

### Step 5: Upload Your Work (Optional)

If authenticated and you've created a design doc or spec, upload it so others (and future queries) can find it:

```bash
node cli/dist/index.js upload <file.md> \
  --project "<project-name>" \
  --overwrite \
  --format json
```

## Reading the Output

### Related command output (JSON)

```json
{
  "query": "login-redesign.md",
  "related": [
    { "path": "demo/Designs/Login Screen Spec", "score": 0.44, "content": "..." },
    { "path": "scrapedata/design-system-docs/auth-best-practices", "score": 0.38, "content": "..." }
  ]
}
```

- **score**: 0.0–1.0 relevance. Above 0.3 is meaningful, above 0.6 is strongly related.
- **path**: Location in DesignForge. Paths starting with `scrapedata/` are from GitHub repos.
- **content**: Full markdown content (when `--include-content` is used).

### How to use the context

1. Read through the related documents
2. Identify relevant patterns, decisions, requirements, or constraints
3. Check for gaps — does your current work contradict or miss anything in existing docs?
4. Reference specific documents when making design decisions

## Listing Projects

To see available projects:

```bash
node cli/dist/index.js pull --help
```

Or query the API directly:

```bash
curl -s <DFCLI_URL>/api/cli/projects | python3 -m json.tool
```

## Tips

- **Start broad, then narrow**: First query with `--source all`, then filter to `--source scraped --repo <name>` if you get too many results.
- **Low scores can be useful**: A 0.3 score means "loosely related" — still worth scanning for context you might miss.
- **Use `--limit`**: Default is 10 results. Increase with `--limit 20` for broader searches or decrease with `--limit 3` for focused queries.
- **Temp files work fine**: Creating a quick `/tmp/query.md` with keywords is a valid way to search when you don't have a matching local file.
- **Check the Index first**: `pull scrapedata/Index` gives you a bird's-eye view of all scraped content before diving into specific files.
