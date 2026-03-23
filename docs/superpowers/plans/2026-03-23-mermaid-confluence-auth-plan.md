# Mermaid Rendering, Confluence Export & Username Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile jsdom mermaid renderer with mermaid-cli for reliable SVG export, improve Confluence export to render markdown as HTML, and switch from email-based to username-based authentication.

**Architecture:** Three independent workstreams: (1) swap the mermaid rendering backend from jsdom to `@mermaid-js/mermaid-cli` (`mmdc`) which uses headless Chromium, (2) update Confluence export to use `marked` for markdown-to-HTML conversion instead of wrapping in code blocks, (3) add a `username` field to the User model, make email optional, and update all auth flows.

**Tech Stack:** Next.js 16, Prisma/SQLite, NextAuth v5, @mermaid-js/mermaid-cli, marked, Vitest

**Spec:** `docs/superpowers/specs/2026-03-23-mermaid-confluence-auth-design.md`

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mermaid-cli and marked, remove jsdom**

```bash
npm install @mermaid-js/mermaid-cli marked && npm uninstall jsdom @types/jsdom
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('@mermaid-js/mermaid-cli')"`
Run: `node -e "require('marked')"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add @mermaid-js/mermaid-cli and marked, remove jsdom"
```

---

## Task 2: Rewrite mermaid-utils.ts to use mmdc CLI

**Files:**
- Modify: `src/lib/export/mermaid-utils.ts`

- [ ] **Step 1: Write the new mermaid-utils.ts**

Replace the entire file with:

```typescript
/**
 * Mermaid rendering utilities using @mermaid-js/mermaid-cli (mmdc).
 * Renders diagrams via headless Chromium for reliable SVG/PNG output.
 */

import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { marked } from "marked";

const execFileAsync = promisify(execFile);

/** Resolve the mmdc binary path from @mermaid-js/mermaid-cli */
function getMmdcPath(): string {
  try {
    return require.resolve("@mermaid-js/mermaid-cli/dist/mermaid-cli.js");
  } catch {
    // Fallback: try the bin entry
    const pkgDir = path.dirname(require.resolve("@mermaid-js/mermaid-cli/package.json"));
    return path.join(pkgDir, "dist", "mermaid-cli.js");
  }
}

const MMDC_PATH = getMmdcPath();

/**
 * Create a temporary puppeteer config for running in Docker/CI (non-root).
 * Chromium requires --no-sandbox when running as a non-root user.
 */
let puppeteerConfigPath: string | null = null;
async function getPuppeteerConfigPath(): Promise<string> {
  if (puppeteerConfigPath) return puppeteerConfigPath;
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mermaid-config-"));
  const configPath = path.join(tmpDir, "puppeteer-config.json");
  await writeFile(configPath, JSON.stringify({ args: ["--no-sandbox", "--disable-setuid-sandbox"] }), "utf-8");
  puppeteerConfigPath = configPath;
  return configPath;
}

/** Error placeholder HTML for failed diagram renders */
function errorPlaceholder(message: string): string {
  const safeMsg = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="background:#f3f4f6;border:1px solid #e5e7eb;padding:16px;border-radius:8px;color:#6b7280;font-style:italic">Diagram render error: ${safeMsg}</div>`;
}

/** Render mermaid code to SVG using mmdc CLI */
export async function renderMermaidToSvg(code: string, id: string): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `mermaid-${id}-`));
  const inputFile = path.join(tmpDir, "input.mmd");
  const outputFile = path.join(tmpDir, "output.svg");

  try {
    await writeFile(inputFile, code, "utf-8");
    const configPath = await getPuppeteerConfigPath();
    await execFileAsync("node", [MMDC_PATH, "-i", inputFile, "-o", outputFile, "-e", "svg", "-p", configPath], {
      timeout: 30000,
    });
    const svg = await readFile(outputFile, "utf-8");
    return svg;
  } finally {
    // Clean up temp files
    await Promise.allSettled([
      unlink(inputFile),
      unlink(outputFile),
      unlink(tmpDir).catch(() => {
        // rmdir only works on empty dirs; use rm -rf pattern
        return import("fs/promises").then(fs => fs.rm(tmpDir, { recursive: true, force: true }));
      }),
    ]);
  }
}

/** Render mermaid code to PNG buffer for embedding in docx */
export async function renderMermaidToPng(code: string, id: string): Promise<Buffer> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `mermaid-png-${id}-`));
  const inputFile = path.join(tmpDir, "input.mmd");
  const outputFile = path.join(tmpDir, "output.png");

  try {
    await writeFile(inputFile, code, "utf-8");
    const configPath = await getPuppeteerConfigPath();
    await execFileAsync("node", [MMDC_PATH, "-i", inputFile, "-o", outputFile, "-e", "png", "-p", configPath], {
      timeout: 30000,
    });
    const pngBuffer = await readFile(outputFile);
    return Buffer.from(pngBuffer);
  } finally {
    await Promise.allSettled([
      unlink(inputFile),
      unlink(outputFile),
      import("fs/promises").then(fs => fs.rm(tmpDir, { recursive: true, force: true })),
    ]);
  }
}

/**
 * Convert markdown with mermaid blocks to HTML with pre-rendered SVGs.
 * Returns the HTML string. Individual diagram failures produce error
 * placeholders — the function itself never throws.
 */
export async function markdownToHtmlWithMermaidSvg(
  content: string
): Promise<string> {
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let result = "";
  let lastIndex = 0;
  let diagramIndex = 0;

  let match;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      result += `<div class="markdown-text">${await marked.parse(before)}</div>`;
    }

    const mermaidCode = match[1].trim();
    try {
      const svg = await renderMermaidToSvg(mermaidCode, `diagram-${diagramIndex++}`);
      result += `<div class="mermaid">${svg}</div>`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Mermaid render failed:", message);
      result += `<div class="mermaid">${errorPlaceholder(message)}</div>`;
    }

    lastIndex = match.index + match[0].length;
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    result += `<div class="markdown-text">${await marked.parse(remaining)}</div>`;
  }

  return result;
}

/** Check if markdown content contains mermaid code blocks */
export function containsMermaid(content: string): boolean {
  return /```mermaid\s*\n/.test(content);
}

/** Extract just the mermaid code blocks from markdown */
export function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
```

Key changes:
- Removed all jsdom code (ensureMermaidDom, ensureDomGlobals, render mutex, mermaid singleton)
- Removed `markdownToHtmlWithMermaid` (client-side rendering function)
- Removed dynamic `sharp` import
- `renderMermaidToSvg` and `renderMermaidToPng` use temp files + `mmdc` CLI
- `markdownToHtmlWithMermaidSvg` returns `string` instead of `{ html, needsFallback }`
- Error handling produces styled placeholder instead of raw mermaid fallback

- [ ] **Step 2: Run existing tests to see what breaks**

Run: `npx vitest run tests/exports.test.ts 2>&1 | head -80`
Expected: Some tests fail (markdownToHtmlWithMermaid import missing, needsFallback destructuring)

- [ ] **Step 3: Commit**

```bash
git add src/lib/export/mermaid-utils.ts
git commit -m "Rewrite mermaid-utils to use @mermaid-js/mermaid-cli instead of jsdom"
```

---

## Task 3: Update html.ts to remove CDN fallback and needsFallback

**Files:**
- Modify: `src/lib/export/html.ts`

- [ ] **Step 1: Update html.ts**

Apply these changes to `src/lib/export/html.ts`:

1. Remove the `MERMAID_SCRIPT` constant (lines 29-34)
2. Remove `includeMermaidCdn` parameter from `buildHtmlDocument` — it always builds without CDN now
3. Update `renderDesignContentHtml` to return `string` instead of `{ html, needsFallback }`
4. Remove the try/catch CDN fallback logic in `renderDesignContentHtml`
5. Update `exportToHtml` and `exportDesignToHtml` to not track `needsFallback`

The updated file:

```typescript
import { prisma } from "@/lib/db";
import { containsMermaid, markdownToHtmlWithMermaidSvg } from "./mermaid-utils";
import { marked } from "marked";

const HTML_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
  h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
  h2 { color: #1F2937; margin-top: 30px; }
  h3 { color: #374151; }
  .comment { background: #F3F4F6; border-left: 3px solid #4F46E5; padding: 12px; margin: 8px 0; border-radius: 4px; }
  .comment.resolved { border-left-color: #10B981; opacity: 0.7; }
  .reply { margin-left: 20px; padding: 8px; background: #E5E7EB; border-radius: 4px; margin-top: 4px; }
  .pin-badge { display: inline-block; background: #4F46E5; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 8px; }
  .pin-badge.resolved { background: #10B981; }
  .meta { font-size: 12px; color: #6B7280; }
  .status { font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 3px; }
  .status.open { background: #FEE2E2; color: #DC2626; }
  .status.resolved { background: #D1FAE5; color: #059669; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #F9FAFB; font-weight: 600; }
  .markdown-content { background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 8px 0; }
  .markdown-text pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
  .mermaid { display: flex; justify-content: center; padding: 16px; margin: 16px 0; background: white; border: 1px solid #E5E7EB; border-radius: 8px; }
  .mermaid svg { max-width: 100%; height: auto; }
  @media print { .mermaid svg { max-width: 100%; } }
`;

function buildHtmlDocument(bodyContent: string): Buffer {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${HTML_STYLES}</style>
</head>
<body>${bodyContent}</body></html>`;
  return Buffer.from(html, "utf-8");
}

function renderCommentsHtml(comments: any[]): string {
  if (comments.length === 0) return "";

  let html = `<h4>Comments</h4>`;

  for (const comment of comments) {
    const resolvedClass = comment.resolved ? "resolved" : "";
    const statusText = comment.resolved ? "RESOLVED" : "OPEN";
    const statusClass = comment.resolved ? "resolved" : "open";

    html += `<div class="comment ${resolvedClass}">`;
    html += `<span class="pin-badge ${resolvedClass}">${comment.pinNumber}</span>`;
    html += `<span class="status ${statusClass}">${statusText}</span>`;
    html += ` <span class="meta">at (${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%) by <strong>${esc(comment.authorName)}</strong></span>`;
    html += `<p>${esc(comment.content)}</p>`;

    for (const reply of comment.replies) {
      html += `<div class="reply"><strong>${esc(reply.authorName)}</strong>: ${esc(reply.content)}</div>`;
    }

    html += `</div>`;
  }

  return html;
}

async function renderDesignContentHtml(content: string): Promise<string> {
  if (!containsMermaid(content)) {
    const rendered = await marked.parse(content);
    return `<div class="markdown-content">${rendered}</div>`;
  }
  const rendered = await markdownToHtmlWithMermaidSvg(content);
  return `<div class="markdown-content">${rendered}</div>`;
}

export async function exportToHtml(projectId: string): Promise<Buffer> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      folders: {
        orderBy: { order: "asc" },
        include: {
          designs: {
            orderBy: { order: "asc" },
            include: {
              comments: {
                orderBy: { pinNumber: "asc" },
                include: {
                  replies: { orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    return Buffer.from("Project not found");
  }

  let body = `<h1>${esc(project.name)}</h1>`;
  if (project.description) {
    body += `<p>${esc(project.description)}</p>`;
  }

  for (const folder of project.folders) {
    body += `<h2>${esc(folder.name)}</h2>`;

    for (const design of folder.designs) {
      body += `<h3>${esc(design.name)} <span class="meta">(${design.type})</span></h3>`;

      if (design.type === "MARKDOWN" && design.content) {
        body += await renderDesignContentHtml(design.content);
      }

      body += renderCommentsHtml(design.comments);
    }
  }

  return buildHtmlDocument(body);
}

/** Export a single design as HTML */
export async function exportDesignToHtml(designId: string): Promise<Buffer> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      comments: {
        orderBy: { pinNumber: "asc" },
        include: {
          replies: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!design) {
    return Buffer.from("Design not found");
  }

  let body = `<h1>${esc(design.name)} <span class="meta">(${design.type})</span></h1>`;

  if (design.type === "MARKDOWN" && design.content) {
    body += await renderDesignContentHtml(design.content);
  }

  body += renderCommentsHtml(design.comments);

  return buildHtmlDocument(body);
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/html.ts
git commit -m "Remove CDN fallback and needsFallback from HTML export"
```

---

## Task 4: Update confluence.ts to render markdown as HTML

**Files:**
- Modify: `src/lib/export/confluence.ts`

- [ ] **Step 1: Update confluence.ts**

The key change: non-mermaid markdown text gets converted to HTML via `marked.parse()` and wrapped in `ac:structured-macro ac:name="html"` instead of `ac:name="code"`.

Update `renderDesignContentConfluence` in `src/lib/export/confluence.ts`:

```typescript
import { prisma } from "@/lib/db";
import { renderMermaidToSvg } from "./mermaid-utils";
import { marked } from "marked";

async function renderDesignContentConfluence(
  content: string,
  prefix: string
): Promise<string> {
  try {
    let html = "";
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
    let lastIdx = 0;
    let mermaidMatch;
    let hasParts = false;

    let diagramIdx = 0;
    while ((mermaidMatch = mermaidRegex.exec(content)) !== null) {
      hasParts = true;
      const before = content.slice(lastIdx, mermaidMatch.index).trim();
      if (before) {
        const renderedHtml = await marked.parse(before);
        html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
      }
      const mermaidCode = mermaidMatch[1].trim();
      try {
        const svg = await renderMermaidToSvg(mermaidCode, `${prefix}-${diagramIdx++}`);
        html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[<div style="display:flex;justify-content:center;padding:16px">${svg}</div>]]></ac:plain-text-body></ac:structured-macro>\n`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Mermaid render failed for confluence diagram ${prefix}-${diagramIdx - 1}:`, err);
        html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[<div style="background:#f3f4f6;border:1px solid #e5e7eb;padding:16px;border-radius:8px;color:#6b7280;font-style:italic">Diagram render error: ${esc(message)}</div>]]></ac:plain-text-body></ac:structured-macro>\n`;
      }
      lastIdx = mermaidMatch.index + mermaidMatch[0].length;
    }

    const remaining = content.slice(lastIdx).trim();
    if (remaining) {
      const renderedHtml = await marked.parse(remaining);
      html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
    }

    if (!hasParts) {
      const renderedHtml = await marked.parse(content);
      html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
    }

    return html;
  } catch (err) {
    console.error("renderDesignContentConfluence failed entirely:", err);
    const renderedHtml = await marked.parse(content);
    return `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
  }
}
```

The rest of the file (`renderCommentsConfluence`, `exportToConfluence`, `exportDesignToConfluence`, `esc`) stays the same.

- [ ] **Step 2: Commit**

```bash
git add src/lib/export/confluence.ts
git commit -m "Render markdown as HTML in Confluence export instead of code blocks"
```

---

## Task 5: Update export tests

**Files:**
- Modify: `tests/exports.test.ts`

- [ ] **Step 1: Update imports — remove markdownToHtmlWithMermaid**

In `tests/exports.test.ts`, change the import block (lines 13-20):

```typescript
import {
  renderMermaidToSvg,
  renderMermaidToPng,
  markdownToHtmlWithMermaidSvg,
  containsMermaid,
  extractMermaidBlocks,
} from "@/lib/export/mermaid-utils";
```

(Removed `markdownToHtmlWithMermaid` from imports)

- [ ] **Step 2: Remove markdownToHtmlWithMermaid tests**

Delete the two tests that use `markdownToHtmlWithMermaid` (lines 49-75 in the "Mermaid Utils" describe block):

- "should convert mermaid blocks to renderable divs without escaping"
- "should handle content with no mermaid blocks"

- [ ] **Step 3: Update markdownToHtmlWithMermaidSvg tests**

In the "markdownToHtmlWithMermaidSvg" describe block (lines 359-407), update the tests to match the new return type (string, not `{ html, needsFallback }`):

```typescript
describe("markdownToHtmlWithMermaidSvg", () => {
  it("should pre-render mermaid blocks as inline SVGs", async () => {
    const md = `# Intro

\`\`\`mermaid
${DIAGRAM_FLOWCHART}
\`\`\`

Some trailing text`;

    const html = await markdownToHtmlWithMermaidSvg(md);

    expect(html).toContain("<svg");
    expect(html).toContain("</svg>");
    // Raw mermaid code should not appear
    expect(html).not.toContain("flowchart TD");
    // Surrounding text should be present
    expect(html).toContain("Intro");
    expect(html).toContain("trailing text");
  });

  it("should handle multiple mermaid blocks in one document", async () => {
    const md = `Text before

\`\`\`mermaid
${DIAGRAM_FLOWCHART}
\`\`\`

Middle text

\`\`\`mermaid
${DIAGRAM_SEQUENCE}
\`\`\`

Text after`;

    const html = await markdownToHtmlWithMermaidSvg(md);

    // Should contain two SVGs
    const svgCount = (html.match(/<svg/g) || []).length;
    expect(svgCount).toBe(2);

    expect(html).toContain("Text before");
    expect(html).toContain("Middle text");
    expect(html).toContain("Text after");
  });
});
```

- [ ] **Step 4: Add error handling test**

Add a new test to verify error placeholders:

```typescript
describe("Mermaid error handling", () => {
  it("should return error placeholder for invalid mermaid syntax", async () => {
    const svg = await renderMermaidToSvg("this is not valid mermaid", "err-test");
    // If mmdc fails, renderMermaidToSvg throws — but markdownToHtmlWithMermaidSvg catches it
  });

  it("should produce error placeholder in markdownToHtmlWithMermaidSvg for bad syntax", async () => {
    const md = `# Title

\`\`\`mermaid
this is completely invalid mermaid syntax !!!
\`\`\`

After text`;

    const html = await markdownToHtmlWithMermaidSvg(md);

    expect(html).toContain("Diagram render error");
    expect(html).toContain("Title");
    expect(html).toContain("After text");
  });
});
```

- [ ] **Step 5: Update Confluence export tests to check for HTML macros instead of code blocks**

In the "Confluence Export" describe block, update the "should export Confluence markup with project structure" test to also verify HTML macros are used for markdown content:

Add this assertion to the existing test or add a new test:

```typescript
  it("should render non-mermaid markdown as HTML (not code blocks)", async () => {
    const html = await exportToConfluence(projectId);

    // Non-mermaid text should be in HTML macros, not code macros
    expect(html).toContain('ac:name="html"');
    // Should NOT wrap regular markdown in code blocks
    // The "Notes here" text from setup should be rendered as HTML
    expect(html).not.toMatch(/ac:name="code"[^>]*>.*Notes here/s);
  });
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/exports.test.ts`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add tests/exports.test.ts
git commit -m "Update export tests for mmdc-based rendering and new return types"
```

---

## Task 6: Update Prisma schema for username-based auth

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update User model**

In `prisma/schema.prisma`, replace the User model (lines 10-19):

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique
  email        String?
  name         String?
  passwordHash String
  createdAt    DateTime  @default(now())
  projects     Project[]
  comments     Comment[]
  replies      Reply[]
}
```

Changes: added `username String @unique`, changed `email` from `String @unique` to `String?` (optional, no unique constraint).

- [ ] **Step 2: Push schema to dev database**

Run: `npx prisma db push --accept-data-loss`
Expected: Schema updated successfully (fresh database, no data to lose)

- [ ] **Step 3: Generate Prisma client**

Run: `npx prisma generate`
Expected: Prisma Client generated

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "Add username field, make email optional in User model"
```

---

## Task 7: Update auth configuration and registration

**Files:**
- Modify: `src/lib/auth.ts`
- Modify: `src/app/api/auth/register/route.ts`

- [ ] **Step 1: Update auth.ts for username-based login**

Replace `src/lib/auth.ts`:

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: (credentials.username as string).toLowerCase() },
        });

        if (!user) return null;

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, username: user.username };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as any).username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).username = token.username as string;
      }
      return session;
    },
  },
});
```

- [ ] **Step 2: Update registration route**

Replace `src/app/api/auth/register/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/db";

const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateUsername(username: string): string | null {
  if (!username || username.length < 3) return "Username must be at least 3 characters";
  if (username.length > 39) return "Username must be 39 characters or fewer";
  if (!USERNAME_REGEX.test(username)) return "Username can only contain letters, numbers, hyphens, and underscores";
  if (username.startsWith("-") || username.endsWith("-")) return "Username cannot start or end with a hyphen";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password, name, email } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const usernameError = validateUsername(username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    const normalizedUsername = username.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { username: normalizedUsername } });
    if (existing) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        email: email || null,
        name: name || null,
        passwordHash,
      },
    });

    return NextResponse.json(
      { id: user.id, username: user.username, name: user.name },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/register/route.ts
git commit -m "Switch auth to username-based login, add username validation"
```

---

## Task 8: Update registration and login UI

**Files:**
- Modify: `src/app/(auth)/register/page.tsx`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Update registration page**

Replace `src/app/(auth)/register/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, email, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      // Auto-login after registration
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Registration succeeded but login failed. Please try logging in.");
        setLoading(false);
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DesignForge
          </Link>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Create your account
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-sm rounded-xl p-8 border border-gray-200"
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={39}
              pattern="[a-zA-Z0-9_-]+"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="your-username"
            />
            <p className="mt-1 text-xs text-gray-500">
              3-39 characters. Letters, numbers, hyphens, underscores only.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Your name"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{" "}
            <Link href="/login" className="text-indigo-600 hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update login page**

Replace `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid username or password");
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            DesignForge
          </Link>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            Sign in to your account
          </h2>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white shadow-sm rounded-xl p-8 border border-gray-200"
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="your-username"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>

          <p className="mt-4 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-indigo-600 hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(auth)/register/page.tsx src/app/(auth)/login/page.tsx
git commit -m "Update registration and login UI for username-based auth"
```

---

## Task 9: Update Header.tsx and types

**Files:**
- Modify: `src/components/layout/Header.tsx`
- Modify: `src/types/index.ts` (no changes needed — types don't include session user)

- [ ] **Step 1: Update Header.tsx**

In `src/components/layout/Header.tsx`, replace both occurrences of `session.user?.email` with `session.user?.username`:

Line 43: `{session.user?.name || session.user?.email}` → `{session.user?.name || session.user?.username}`
Line 92: `{session.user?.name || session.user?.email}` → `{session.user?.name || session.user?.username}`

- [ ] **Step 2: Commit**

```bash
git add src/components/layout/Header.tsx
git commit -m "Update Header to show username instead of email as fallback"
```

---

## Task 10: Update test helpers and auth tests

**Files:**
- Modify: `tests/helpers.ts`
- Modify: `tests/auth.test.ts`

- [ ] **Step 1: Update test helpers**

Replace `createTestUser` in `tests/helpers.ts`:

```typescript
/** Create a test user and return it */
export async function createTestUser(
  overrides: { username?: string; email?: string; name?: string; password?: string } = {}
) {
  const username = overrides.username ?? `test_${Date.now()}`;
  const password = overrides.password ?? "password123";
  const passwordHash = await hash(password, 4); // Low rounds for speed

  return prisma.user.create({
    data: {
      username,
      email: overrides.email ?? null,
      name: overrides.name ?? "Test User",
      passwordHash,
    },
  });
}
```

- [ ] **Step 2: Rewrite auth tests**

Replace `tests/auth.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { hash, compare } from "bcryptjs";
import { prisma, cleanDb } from "./helpers";

describe("Auth - Registration", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  it("should create a user with username and hashed password", async () => {
    const passwordHash = await hash("mypassword", 4);
    const user = await prisma.user.create({
      data: {
        username: "alice",
        name: "Alice",
        passwordHash,
      },
    });

    expect(user.id).toBeDefined();
    expect(user.username).toBe("alice");
    expect(user.name).toBe("Alice");
    expect(user.email).toBeNull();
    expect(user.passwordHash).not.toBe("mypassword");
  });

  it("should create a user with optional email", async () => {
    const passwordHash = await hash("mypassword", 4);
    const user = await prisma.user.create({
      data: {
        username: "bob",
        email: "bob@example.com",
        name: "Bob",
        passwordHash,
      },
    });

    expect(user.username).toBe("bob");
    expect(user.email).toBe("bob@example.com");
  });

  it("should reject duplicate usernames", async () => {
    const passwordHash = await hash("pass", 4);
    await prisma.user.create({
      data: { username: "duplicate", name: "A", passwordHash },
    });

    await expect(
      prisma.user.create({
        data: { username: "duplicate", name: "B", passwordHash },
      })
    ).rejects.toThrow();
  });

  it("should enforce case-insensitive username uniqueness (store lowercase)", async () => {
    const passwordHash = await hash("pass", 4);
    await prisma.user.create({
      data: { username: "aayush", name: "A", passwordHash },
    });

    // Same username, different case — should be stored as lowercase by the app
    // The database enforces uniqueness on the stored value
    await expect(
      prisma.user.create({
        data: { username: "aayush", name: "B", passwordHash },
      })
    ).rejects.toThrow();
  });

  it("should verify correct password", async () => {
    const password = "secret123";
    const passwordHash = await hash(password, 4);
    await prisma.user.create({
      data: { username: "charlie", name: "Charlie", passwordHash },
    });

    const user = await prisma.user.findUnique({
      where: { username: "charlie" },
    });
    expect(user).not.toBeNull();

    const isValid = await compare(password, user!.passwordHash);
    expect(isValid).toBe(true);

    const isWrong = await compare("wrongpass", user!.passwordHash);
    expect(isWrong).toBe(false);
  });
});
```

- [ ] **Step 3: Run auth tests**

Run: `npx vitest run tests/auth.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/helpers.ts tests/auth.test.ts
git commit -m "Update test helpers and auth tests for username-based registration"
```

---

## Task 11: Update Dockerfile for Chromium support

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Update Dockerfile**

Replace the Dockerfile:

```dockerfile
FROM node:20-slim AS base

# Install Chromium dependencies for mermaid-cli
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/@mermaid-js ./node_modules/@mermaid-js
COPY --from=builder /app/node_modules/mermaid ./node_modules/mermaid

RUN mkdir -p uploads && chown nextjs:nodejs uploads
RUN mkdir -p prisma && chown nextjs:nodejs prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "npx prisma db push --skip-generate && node server.js"]
```

Key changes:
- `node:20-alpine` → `node:20-slim` (Debian-based, better Chromium compat)
- Install Chromium and system deps
- Set `PUPPETEER_EXECUTABLE_PATH` and `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD`
- Copy `@mermaid-js` and `mermaid` node_modules into runner stage

- [ ] **Step 2: Commit**

```bash
git add Dockerfile
git commit -m "Switch to node:20-slim and add Chromium deps for mermaid-cli"
```

---

## Task 12: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 4: Fix any issues found**

Address any failures from the above steps.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "Final verification: all tests pass, build succeeds"
```
