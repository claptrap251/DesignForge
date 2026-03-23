# Confluence Copy, Auto-Author, and Comment Anchoring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Confluence copy-to-clipboard, auto-fill comment author from session, and line-based comment anchoring for markdown designs.

**Architecture:** Three independent features layered onto the existing comment system. Feature 1 (copy) is frontend-only. Feature 2 (auto-author) threads `sessionUser` through the component tree and adds `authorId` to API calls. Feature 3 (anchoring) is the largest: schema changes, a new anchor resolution library, a remark plugin for source-line mapping, and a new LineGutter component replacing PinLayer for markdown designs.

**Tech Stack:** Next.js 16.2.1, React 19, Prisma/SQLite, NextAuth v5 beta, react-markdown 10.1, remark-gfm 4.0, Vitest 4.1, Tailwind CSS 4.

**Spec:** `docs/superpowers/specs/2026-03-23-confluence-copy-author-anchoring-design.md`

---

## Task 1: Schema — Make xPercent/yPercent Nullable and Add Anchor Fields

**Files:**
- Modify: `prisma/schema.prisma:74-89` (Comment model)
- Modify: `tests/helpers.ts` (add helper for markdown anchored comments)

- [ ] **Step 1: Update the Comment model in schema.prisma**

In `prisma/schema.prisma`, change the Comment model. Make `xPercent` and `yPercent` nullable (`Float?`) and add five new anchor fields:

```prisma
model Comment {
  id        String   @id @default(cuid())
  designId  String
  design    Design   @relation(fields: [designId], references: [id], onDelete: Cascade)
  xPercent  Float?
  yPercent  Float?
  pinNumber Int
  content   String
  authorName String
  authorId  String?
  author    User?    @relation(fields: [authorId], references: [id], onDelete: SetNull)
  resolved  Boolean  @default(false)
  anchorLine    Int?
  anchorHeading String?
  anchorContext String?
  contextBefore String?
  contextAfter  String?
  replies   Reply[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run: `cd /home/aayush/code/DesignForge && npx prisma db push --force-reset && npx prisma generate`

Expected: Schema pushed, client regenerated.

- [ ] **Step 3: Add test helper for anchored comments**

In `tests/helpers.ts`, add a new helper function after `createTestMarkdownDesign`:

```typescript
/** Create a test comment (image-style with xPercent/yPercent) */
export async function createTestImageComment(
  designId: string,
  overrides: { xPercent?: number; yPercent?: number; pinNumber?: number; content?: string; authorName?: string } = {}
) {
  return prisma.comment.create({
    data: {
      designId,
      xPercent: overrides.xPercent ?? 50.0,
      yPercent: overrides.yPercent ?? 50.0,
      pinNumber: overrides.pinNumber ?? 1,
      content: overrides.content ?? "Test comment",
      authorName: overrides.authorName ?? "Tester",
    },
    include: { replies: true },
  });
}

/** Create a test comment (markdown-style with anchor fields) */
export async function createTestAnchoredComment(
  designId: string,
  overrides: {
    anchorLine?: number; anchorHeading?: string; anchorContext?: string;
    contextBefore?: string; contextAfter?: string;
    pinNumber?: number; content?: string; authorName?: string;
  } = {}
) {
  return prisma.comment.create({
    data: {
      designId,
      anchorLine: overrides.anchorLine ?? 5,
      anchorHeading: overrides.anchorHeading ?? "## Section",
      anchorContext: overrides.anchorContext ?? "Some content line",
      contextBefore: overrides.contextBefore ?? "line before 1\nline before 2",
      contextAfter: overrides.contextAfter ?? "line after 1\nline after 2",
      pinNumber: overrides.pinNumber ?? 1,
      content: overrides.content ?? "Test anchored comment",
      authorName: overrides.authorName ?? "Tester",
    },
    include: { replies: true },
  });
}
```

- [ ] **Step 4: Run existing tests to verify schema change doesn't break them**

Run: `cd /home/aayush/code/DesignForge && npx vitest run 2>&1 | tail -30`

Expected: Tests should fail because existing test code creates comments with `xPercent`/`yPercent` as required fields but the schema now allows null. The existing `createTestImageComment` calls in tests still pass explicit values so they should still work. But the comment API validation (which checks `xPercent === undefined`) needs to be updated in a later task. For now, check that the schema push and prisma generate succeed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma tests/helpers.ts
git commit -m "feat: make xPercent/yPercent nullable, add anchor fields to Comment"
```

---

## Task 2: Anchor Resolution Library

**Files:**
- Create: `src/lib/anchor.ts`
- Create: `tests/anchor.test.ts`

- [ ] **Step 1: Write failing tests for resolveAnchor**

Create `tests/anchor.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveAnchor, computeAnchor } from "@/lib/anchor";

describe("resolveAnchor", () => {
  const baseComment = {
    anchorLine: 5,
    anchorHeading: "## Section A",
    anchorContext: "This is the anchored line",
    contextBefore: "line before 1\nline before 2",
    contextAfter: "line after 1\nline after 2",
  };

  it("returns exact when heading + line + context all match", () => {
    const content = [
      "# Title",
      "",
      "## Section A",
      "line before 2",
      "This is the anchored line",
      "line after 1",
      "line after 2",
    ].join("\n");
    const result = resolveAnchor(baseComment, content);
    expect(result.confidence).toBe("exact");
    expect(result.line).toBe(5);
  });

  it("returns fuzzy when context moved but matches", () => {
    // Content shifted: anchor line is now at line 7 instead of 5
    const content = [
      "# Title",
      "",
      "## Section A",
      "new line inserted",
      "another new line",
      "line before 2",
      "This is the anchored line",
      "line after 1",
      "line after 2",
    ].join("\n");
    const result = resolveAnchor(baseComment, content);
    expect(result.confidence).toBe("fuzzy");
    expect(result.line).toBe(7);
  });

  it("returns fallback when no context match but line in range", () => {
    const content = [
      "# Title",
      "",
      "## Different Section",
      "completely different content",
      "more different content",
      "still different",
      "end",
    ].join("\n");
    const result = resolveAnchor(baseComment, content);
    expect(result.confidence).toBe("fallback");
    expect(result.line).toBe(5);
  });

  it("returns orphaned when document shorter than anchorLine and no match", () => {
    const content = "# Short\n\nOnly three lines";
    const result = resolveAnchor(baseComment, content);
    expect(result.confidence).toBe("orphaned");
    expect(result.line).toBe(-1);
  });

  it("handles anchor at line 1", () => {
    const comment = {
      anchorLine: 1,
      anchorHeading: null,
      anchorContext: "# Title",
      contextBefore: null,
      contextAfter: "second line\nthird line",
    };
    const content = "# Title\nsecond line\nthird line";
    const result = resolveAnchor(comment, content);
    expect(result.confidence).toBe("exact");
    expect(result.line).toBe(1);
  });
});

describe("computeAnchor", () => {
  const markdown = [
    "# Title",
    "",
    "Some intro paragraph.",
    "",
    "## Process Flow",
    "",
    "Step 1: Do this",
    "Step 2: Do that",
    "",
    "## Another Section",
    "",
    "Content here",
  ].join("\n");

  it("computes anchor fields for a line under a heading", () => {
    const result = computeAnchor(7, markdown);
    expect(result.anchorLine).toBe(7);
    expect(result.anchorHeading).toBe("## Process Flow");
    expect(result.anchorContext).toBe("Step 1: Do this");
    expect(result.contextBefore).toBe("\nStep 1: Do this".split("\n").slice(0, -1).join("\n"));
  });

  it("computes anchor at line 1 (no heading above, no context before)", () => {
    const result = computeAnchor(1, markdown);
    expect(result.anchorLine).toBe(1);
    expect(result.anchorHeading).toBeNull();
    expect(result.anchorContext).toBe("# Title");
    expect(result.contextBefore).toBeNull();
  });

  it("computes anchor at last line", () => {
    const lines = markdown.split("\n");
    const result = computeAnchor(lines.length, markdown);
    expect(result.anchorLine).toBe(lines.length);
    expect(result.anchorContext).toBe("Content here");
    expect(result.contextAfter).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/aayush/code/DesignForge && npx vitest run tests/anchor.test.ts 2>&1 | tail -20`

Expected: FAIL — module `@/lib/anchor` not found.

- [ ] **Step 3: Implement the anchor library**

Create `src/lib/anchor.ts`:

```typescript
export type AnchorResult = {
  line: number;
  confidence: "exact" | "fuzzy" | "fallback" | "orphaned";
};

export type AnchorFields = {
  anchorLine: number | null;
  anchorHeading: string | null;
  anchorContext: string | null;
  contextBefore: string | null;
  contextAfter: string | null;
};

export type ComputedAnchor = {
  anchorLine: number;
  anchorHeading: string | null;
  anchorContext: string;
  contextBefore: string | null;
  contextAfter: string | null;
};

/**
 * Resolve a comment's anchor against the current markdown content.
 * Returns the resolved line number and confidence level.
 */
export function resolveAnchor(comment: AnchorFields, currentContent: string): AnchorResult {
  if (!comment.anchorLine || !comment.anchorContext) {
    return { line: -1, confidence: "orphaned" };
  }

  const lines = currentContent.split("\n");
  const totalLines = lines.length;

  // Strategy 1: Heading + line match
  if (comment.anchorHeading) {
    const headingIdx = lines.findIndex(
      (l) => l.trim() === comment.anchorHeading!.trim()
    );
    if (headingIdx !== -1) {
      // Find original heading position to compute offset
      const originalOffset = comment.anchorLine - findOriginalHeadingLine(comment);
      const candidateLine = headingIdx + 1 + originalOffset; // 1-based
      if (
        candidateLine >= 1 &&
        candidateLine <= totalLines &&
        lines[candidateLine - 1].trim() === comment.anchorContext.trim()
      ) {
        return { line: candidateLine, confidence: "exact" };
      }
    }
  }

  // Also check if original line still has exact content (exact without heading)
  if (
    comment.anchorLine >= 1 &&
    comment.anchorLine <= totalLines &&
    lines[comment.anchorLine - 1].trim() === comment.anchorContext.trim()
  ) {
    return { line: comment.anchorLine, confidence: "exact" };
  }

  // Strategy 2: Context fuzzy match — find the line by content
  for (let i = 0; i < totalLines; i++) {
    if (lines[i].trim() === comment.anchorContext.trim()) {
      // Verify with surrounding context
      if (verifyContext(lines, i, comment.contextBefore, comment.contextAfter)) {
        return { line: i + 1, confidence: "fuzzy" };
      }
    }
  }

  // Strategy 3: Line number fallback
  if (comment.anchorLine >= 1 && comment.anchorLine <= totalLines) {
    return { line: comment.anchorLine, confidence: "fallback" };
  }

  // Strategy 4: Orphaned
  return { line: -1, confidence: "orphaned" };
}

function findOriginalHeadingLine(comment: AnchorFields): number {
  // The heading was the nearest one above anchorLine.
  // We don't store the heading's line number, so estimate the offset
  // based on the assumption the heading was close (within a few lines).
  // For exact matching, we just need the relative offset from heading to anchor.
  // Since we don't store that, we'll try small offsets.
  // Return 0 as a signal to use direct offset calculation.
  return 0;
}

function verifyContext(
  lines: string[],
  candidateIdx: number,
  contextBefore: string | null,
  contextAfter: string | null
): boolean {
  let beforeMatch = contextBefore === null; // null means no context to check
  let afterMatch = contextAfter === null;

  if (contextBefore) {
    const beforeLines = contextBefore.split("\n");
    for (const bl of beforeLines) {
      for (let j = Math.max(0, candidateIdx - 3); j < candidateIdx; j++) {
        if (lines[j].trim() === bl.trim()) {
          beforeMatch = true;
          break;
        }
      }
      if (beforeMatch) break;
    }
  }

  if (contextAfter) {
    const afterLines = contextAfter.split("\n");
    for (const al of afterLines) {
      for (let j = candidateIdx + 1; j <= Math.min(lines.length - 1, candidateIdx + 3); j++) {
        if (lines[j].trim() === al.trim()) {
          afterMatch = true;
          break;
        }
      }
      if (afterMatch) break;
    }
  }

  return beforeMatch || afterMatch;
}

/**
 * Compute anchor fields for a given line number in the markdown source.
 * lineNumber is 1-based.
 */
export function computeAnchor(lineNumber: number, markdownSource: string): ComputedAnchor {
  const lines = markdownSource.split("\n");
  const idx = lineNumber - 1; // 0-based

  const anchorContext = lines[idx]?.trim() ?? "";

  // Find nearest heading above
  let anchorHeading: string | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (/^#{1,6}\s/.test(lines[i])) {
      anchorHeading = lines[i];
      break;
    }
  }

  // Context before: up to 2 lines
  const beforeLines: string[] = [];
  for (let i = Math.max(0, idx - 2); i < idx; i++) {
    beforeLines.push(lines[i]);
  }
  const contextBefore = beforeLines.length > 0 ? beforeLines.join("\n") : null;

  // Context after: up to 2 lines
  const afterLines: string[] = [];
  for (let i = idx + 1; i <= Math.min(lines.length - 1, idx + 2); i++) {
    afterLines.push(lines[i]);
  }
  const contextAfter = afterLines.length > 0 ? afterLines.join("\n") : null;

  return {
    anchorLine: lineNumber,
    anchorHeading,
    anchorContext,
    contextBefore,
    contextAfter,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/aayush/code/DesignForge && npx vitest run tests/anchor.test.ts 2>&1 | tail -20`

Expected: All tests PASS. Fix any edge cases if needed — the `findOriginalHeadingLine` approach may need tuning for the heading+offset exact match. Adjust the `resolveAnchor` heading strategy to try multiple offsets from the heading.

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor.ts tests/anchor.test.ts
git commit -m "feat: add anchor resolution and computation library with tests"
```

---

## Task 3: Remark Source-Line Plugin

**Files:**
- Create: `src/lib/remarkSourceLines.ts`
- Modify: `src/components/design/MarkdownViewer.tsx`

- [ ] **Step 1: Create the remark plugin**

Create `src/lib/remarkSourceLines.ts`:

```typescript
import { visit } from "unist-util-visit";
import type { Plugin } from "unified";
import type { Root } from "mdast";

/**
 * Remark plugin that annotates top-level AST nodes with data-source-line
 * and data-source-end attributes. These appear as HTML attributes on the
 * rendered elements, enabling the LineGutter to map rendered content back
 * to source lines.
 */
const remarkSourceLines: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, (node) => {
      if (
        node.position &&
        node.type !== "root" &&
        node.type !== "text"
      ) {
        const data = (node as any).data || ((node as any).data = {});
        const hProperties = data.hProperties || (data.hProperties = {});
        hProperties["data-source-line"] = node.position.start.line;
        hProperties["data-source-end"] = node.position.end.line;
      }
    });
  };
};

export default remarkSourceLines;
```

- [ ] **Step 2: Install unist-util-visit if not present**

Run: `cd /home/aayush/code/DesignForge && npm ls unist-util-visit 2>&1 || npm install unist-util-visit`

This is typically a transitive dependency of remark, but we need it directly.

- [ ] **Step 3: Add the plugin to MarkdownViewer**

In `src/components/design/MarkdownViewer.tsx`, add the import and include it in the plugins array:

```tsx
import remarkSourceLines from "@/lib/remarkSourceLines";
```

Update the ReactMarkdown element:
```tsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkSourceLines]}
  ...
```

- [ ] **Step 4: Verify the build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds. If there are type errors with unist types, install `@types/mdast` and `@types/unist` as dev dependencies.

- [ ] **Step 5: Commit**

```bash
git add src/lib/remarkSourceLines.ts src/components/design/MarkdownViewer.tsx package.json package-lock.json
git commit -m "feat: add remark source-line plugin for line-based anchoring"
```

---

## Task 4: Comment API — Accept Anchor Fields and authorId

**Files:**
- Modify: `src/app/api/designs/[id]/comments/route.ts`
- Modify: `src/app/api/comments/[id]/replies/route.ts`

- [ ] **Step 1: Write failing tests for the updated comment API**

Add to `tests/designs.test.ts` (or create a new test file `tests/comment-api.test.ts`):

```typescript
// In an appropriate describe block:
it("creates a comment with anchor fields for MARKDOWN design", async () => {
  const comment = await prisma.comment.create({
    data: {
      designId: design.id,
      anchorLine: 5,
      anchorHeading: "## Section",
      anchorContext: "Some content",
      contextBefore: "line before",
      contextAfter: "line after",
      pinNumber: 1,
      content: "Anchored comment",
      authorName: "Tester",
    },
  });
  expect(comment.anchorLine).toBe(5);
  expect(comment.xPercent).toBeNull();
  expect(comment.yPercent).toBeNull();
});

it("creates a comment with authorId", async () => {
  const user = await createTestUser();
  const comment = await prisma.comment.create({
    data: {
      designId: design.id,
      xPercent: 10,
      yPercent: 20,
      pinNumber: 2,
      content: "Comment with author",
      authorName: "Test User",
      authorId: user.id,
    },
  });
  expect(comment.authorId).toBe(user.id);
});

it("creates a reply with authorId", async () => {
  const user = await createTestUser({ username: "replier" });
  const comment = await prisma.comment.create({
    data: {
      designId: design.id,
      xPercent: 10, yPercent: 20, pinNumber: 3,
      content: "Parent", authorName: "Someone",
    },
  });
  const reply = await prisma.reply.create({
    data: {
      commentId: comment.id,
      content: "Reply content",
      authorName: user.name!,
      authorId: user.id,
    },
  });
  expect(reply.authorId).toBe(user.id);
});
```

- [ ] **Step 2: Update the comments POST route**

In `src/app/api/designs/[id]/comments/route.ts`, update the POST handler:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    xPercent, yPercent, content, authorName, authorId,
    anchorLine, anchorHeading, anchorContext, contextBefore, contextAfter,
  } = body;

  if (!content || !authorName) {
    return NextResponse.json(
      { error: "content and authorName are required" },
      { status: 400 }
    );
  }

  // Validate: either (xPercent + yPercent) or anchorLine, not both, not neither
  const hasPosition = xPercent !== undefined && yPercent !== undefined;
  const hasAnchor = anchorLine !== undefined;

  if (!hasPosition && !hasAnchor) {
    return NextResponse.json(
      { error: "Either (xPercent + yPercent) or anchorLine is required" },
      { status: 400 }
    );
  }
  if (hasPosition && hasAnchor) {
    return NextResponse.json(
      { error: "Cannot provide both (xPercent + yPercent) and anchorLine" },
      { status: 400 }
    );
  }

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const maxPin = await prisma.comment.aggregate({
    where: { designId: id },
    _max: { pinNumber: true },
  });
  const pinNumber = (maxPin._max.pinNumber ?? 0) + 1;

  const comment = await prisma.comment.create({
    data: {
      designId: id,
      xPercent: hasPosition ? xPercent : null,
      yPercent: hasPosition ? yPercent : null,
      anchorLine: hasAnchor ? anchorLine : null,
      anchorHeading: hasAnchor ? (anchorHeading ?? null) : null,
      anchorContext: hasAnchor ? (anchorContext ?? null) : null,
      contextBefore: hasAnchor ? (contextBefore ?? null) : null,
      contextAfter: hasAnchor ? (contextAfter ?? null) : null,
      pinNumber,
      content,
      authorName,
      ...(authorId ? { authorId } : {}),
    },
    include: { replies: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
```

- [ ] **Step 3: Update the replies POST route to accept authorId**

In `src/app/api/comments/[id]/replies/route.ts`:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content, authorName, authorId } = body;

  if (!content || !authorName) {
    return NextResponse.json(
      { error: "content and authorName are required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const reply = await prisma.reply.create({
    data: {
      commentId: id,
      content,
      authorName,
      ...(authorId ? { authorId } : {}),
    },
  });

  return NextResponse.json(reply, { status: 201 });
}
```

- [ ] **Step 4: Run all tests**

Run: `cd /home/aayush/code/DesignForge && npx vitest run 2>&1 | tail -30`

Expected: All tests pass. Fix any existing tests that break due to the xPercent/yPercent nullable change (e.g., tests that create comments without explicit xPercent/yPercent values).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/designs/[id]/comments/route.ts src/app/api/comments/[id]/replies/route.ts tests/
git commit -m "feat: accept anchor fields and authorId in comment/reply APIs"
```

---

## Task 5: Export Null-Safety for Comment Positions

**Files:**
- Modify: `src/lib/export/markdown.ts`
- Modify: `src/lib/export/html.ts`
- Modify: `src/lib/export/confluence.ts`
- Modify: `src/lib/export/docx.ts`

- [ ] **Step 1: Create a shared position-formatting helper**

In each export file, the comment position is formatted. Extract a pattern: if `anchorLine` is set, show `Line N`; if `xPercent`/`yPercent` are set, show `(x%, y%)`.

In `src/lib/export/markdown.ts`, change the comment position line from:
```
at position (${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%)
```
to:
```
${comment.anchorLine != null ? `at Line ${comment.anchorLine}` : `at position (${comment.xPercent?.toFixed(1) ?? '?'}%, ${comment.yPercent?.toFixed(1) ?? '?'}%)`}
```

Apply the same pattern in `exportDesignToMarkdown`.

- [ ] **Step 2: Update html.ts**

In `renderCommentsHtml`, change:
```
at (${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%)
```
to:
```
${comment.anchorLine != null ? `Line ${comment.anchorLine}${comment.anchorHeading ? ` (${esc(comment.anchorHeading)})` : ''}` : `at (${comment.xPercent?.toFixed(1) ?? '?'}%, ${comment.yPercent?.toFixed(1) ?? '?'}%)`}
```

- [ ] **Step 3: Update confluence.ts**

In `renderCommentsConfluence`, change the Position cell from:
```
<td>(${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%)</td>
```
to:
```
<td>${comment.anchorLine != null ? `Line ${comment.anchorLine}` : `(${comment.xPercent?.toFixed(1) ?? '?'}%, ${comment.yPercent?.toFixed(1) ?? '?'}%)`}</td>
```

- [ ] **Step 4: Update docx.ts**

The docx export doesn't currently show position in the table (columns are Pin, Status, Author, Comment). No change needed for position display. But verify that no `.toFixed()` calls on xPercent/yPercent exist. If any are found, add null guards.

- [ ] **Step 5: Add a test for export with anchored comments**

Add to `tests/exports.test.ts`:

```typescript
it("exports markdown comments with anchor line info", async () => {
  // Create a markdown design with an anchored comment
  const comment = await prisma.comment.create({
    data: {
      designId: design.id,
      anchorLine: 7,
      anchorHeading: "## Section",
      anchorContext: "Some content",
      pinNumber: 1,
      content: "Check this line",
      authorName: "Alice",
    },
  });

  const md = await exportDesignToMarkdown(design.id);
  expect(md).toContain("at Line 7");
  expect(md).not.toContain("undefined%");
});
```

- [ ] **Step 6: Run tests**

Run: `cd /home/aayush/code/DesignForge && npx vitest run tests/exports.test.ts 2>&1 | tail -30`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/export/ tests/exports.test.ts
git commit -m "feat: null-safe comment positions in all export formats"
```

---

## Task 6: Confluence Copy Button (ExportDialog)

**Files:**
- Modify: `src/components/export/ExportDialog.tsx`

- [ ] **Step 1: Add copy functionality to ExportDialog**

In `src/components/export/ExportDialog.tsx`, add a `copyStatus` state and a `handleCopyConfluence` function. When `format === "confluence"`, show two buttons: "Download" and "Copy Markup".

After the existing `handleExport` function, add:

```typescript
const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

const handleCopyConfluence = async () => {
  setCopyStatus("copying");
  try {
    const res = await fetch(`/api/export/${projectId}?format=confluence`);
    if (!res.ok) throw new Error("Export failed");
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  } catch {
    setCopyStatus("error");
    setTimeout(() => setCopyStatus("idle"), 3000);
  }
};
```

In the button area (the `mt-6 flex justify-end gap-3` div), replace the single Download button with conditional rendering:

```tsx
{format === "confluence" && (
  <button
    onClick={handleCopyConfluence}
    disabled={copyStatus === "copying"}
    className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
  >
    {copyStatus === "copied" ? (
      "Copied!"
    ) : copyStatus === "error" ? (
      "Copy failed — try downloading"
    ) : copyStatus === "copying" ? (
      "Copying..."
    ) : (
      <>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy Markup
      </>
    )}
  </button>
)}
```

Keep the existing Download button as-is (it always shows).

- [ ] **Step 2: Verify manually (or run build)**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/export/ExportDialog.tsx
git commit -m "feat: add Copy Markup button for Confluence export in ExportDialog"
```

---

## Task 7: Confluence Copy in Per-Design Export Menu

**Files:**
- Modify: `src/app/project/[projectId]/design/[designId]/page.tsx`

- [ ] **Step 1: Add copy state and handler to the design page**

Add state variables after the existing `exporting` state:

```typescript
const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
```

Add handler:

```typescript
const handleCopyConfluence = async () => {
  setCopyStatus("copying");
  setShowExportMenu(false);
  try {
    const res = await fetch(`/api/designs/${designId}/export?format=confluence`);
    if (!res.ok) throw new Error("Export failed");
    const text = await res.text();
    await navigator.clipboard.writeText(text);
    setCopyStatus("copied");
    setTimeout(() => setCopyStatus("idle"), 2000);
  } catch {
    setCopyStatus("error");
    setTimeout(() => setCopyStatus("idle"), 3000);
  }
};
```

- [ ] **Step 2: Add "Copy Confluence" menu item**

In the export dropdown menu (the `showExportMenu && (...)` block), add a new button after the Confluence download button:

```tsx
<button
  onClick={handleCopyConfluence}
  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
>
  <span className="w-5 text-center text-xs font-bold text-indigo-400">
    <svg className="h-3.5 w-3.5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  </span>
  Copy Confluence
</button>
```

Also add a brief "Copied!" indicator near the export button (e.g., a small absolute-positioned badge):

```tsx
{copyStatus === "copied" && (
  <span className="absolute -top-6 right-0 rounded bg-green-600 px-2 py-0.5 text-xs text-white shadow">
    Copied!
  </span>
)}
{copyStatus === "error" && (
  <span className="absolute -top-6 right-0 rounded bg-red-600 px-2 py-0.5 text-xs text-white shadow">
    Copy failed
  </span>
)}
```

- [ ] **Step 3: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/project/[projectId]/design/[designId]/page.tsx
git commit -m "feat: add Copy Confluence button in per-design export dropdown"
```

---

## Task 8: Auto-Fill Comment Author — Component Changes

**Files:**
- Modify: `src/components/comments/CommentForm.tsx`
- Modify: `src/components/comments/CommentThread.tsx`
- Modify: `src/components/comments/PinLayer.tsx`
- Modify: `src/components/comments/CommentSidebar.tsx`

- [ ] **Step 1: Update CommentForm to accept sessionUser**

In `src/components/comments/CommentForm.tsx`:

Update the interface:
```typescript
interface CommentFormProps {
  position: { x: number; y: number };
  onSubmit: (content: string, authorName: string, authorId?: string) => void;
  onCancel: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}
```

Update the component to destructure `sessionUser`:
```typescript
export default function CommentForm({ position, onSubmit, onCancel, sessionUser }: CommentFormProps) {
```

In the `useEffect` that loads from localStorage, only load if no sessionUser:
```typescript
useEffect(() => {
  if (!sessionUser) {
    const savedName = localStorage.getItem("designforge-author-name");
    if (savedName) setAuthorName(savedName);
  }
  setTimeout(() => textareaRef.current?.focus(), 50);
}, [sessionUser]);
```

Update `handleSubmit`:
```typescript
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const name = sessionUser
    ? (sessionUser.name || sessionUser.username || "Unknown")
    : authorName.trim();
  if (!content.trim() || !name) return;
  if (!sessionUser) {
    localStorage.setItem("designforge-author-name", name);
  }
  onSubmit(content.trim(), name, sessionUser?.id);
};
```

Conditionally render the name input (only if no sessionUser):
```tsx
{!sessionUser && (
  <div>
    <input
      type="text"
      value={authorName}
      onChange={(e) => setAuthorName(e.target.value)}
      placeholder="Your name"
      required
      className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
    />
  </div>
)}
```

Update the submit button disabled check:
```tsx
disabled={!content.trim() || (!sessionUser && !authorName.trim())}
```

- [ ] **Step 2: Update CommentThread to accept sessionUser**

In `src/components/comments/CommentThread.tsx`:

Update the interface:
```typescript
interface CommentThreadProps {
  comment: any;
  onResolve: (id: string) => void;
  onReply: (commentId: string, content: string, authorName: string, authorId?: string) => void;
  isSelected: boolean;
  onClick: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}
```

Destructure `sessionUser` in the component.

In the `useEffect` for localStorage, guard with `!sessionUser`:
```typescript
useEffect(() => {
  if (!sessionUser) {
    const savedName = localStorage.getItem("designforge-author-name");
    if (savedName) setReplyAuthor(savedName);
  }
}, [sessionUser]);
```

Update `handleReplySubmit`:
```typescript
const handleReplySubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const name = sessionUser
    ? (sessionUser.name || sessionUser.username || "Unknown")
    : replyAuthor.trim();
  if (!replyContent.trim() || !name) return;
  if (!sessionUser) {
    localStorage.setItem("designforge-author-name", name);
  }
  onReply(comment.id, replyContent.trim(), name, sessionUser?.id);
  setReplyContent("");
  setShowReplyForm(false);
};
```

Conditionally render the reply name input (only if no sessionUser):
```tsx
{!sessionUser && (
  <input
    type="text"
    value={replyAuthor}
    onChange={(e) => setReplyAuthor(e.target.value)}
    placeholder="Your name"
    required
    className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-xs shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
  />
)}
```

Update reply submit disabled check:
```tsx
disabled={!replyContent.trim() || (!sessionUser && !replyAuthor.trim())}
```

- [ ] **Step 3: Update PinLayer to accept and forward sessionUser**

In `src/components/comments/PinLayer.tsx`:

Update the interface:
```typescript
interface PinLayerProps {
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (x: number, y: number, content: string, authorName: string, authorId?: string) => void;
  isAddMode: boolean;
  sessionUser?: { id: string; name?: string; username?: string };
}
```

Destructure `sessionUser`. Update `handleFormSubmit`:
```typescript
const handleFormSubmit = (content: string, authorName: string, authorId?: string) => {
  if (newPinPosition) {
    onAddComment(newPinPosition.x, newPinPosition.y, content, authorName, authorId);
    setNewPinPosition(null);
  }
};
```

Pass `sessionUser` to CommentForm:
```tsx
<CommentForm
  position={newPinPosition}
  onSubmit={handleFormSubmit}
  onCancel={handleFormCancel}
  sessionUser={sessionUser}
/>
```

- [ ] **Step 4: Update CommentSidebar to accept and forward sessionUser**

In `src/components/comments/CommentSidebar.tsx`:

Update the interface:
```typescript
interface CommentSidebarProps {
  comments: any[];
  onResolve: (id: string) => void;
  onReply: (commentId: string, content: string, authorName: string, authorId?: string) => void;
  selectedCommentId: string | null;
  onSelectComment: (id: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}
```

Destructure `sessionUser`. Pass it to each CommentThread:
```tsx
<CommentThread
  key={comment.id}
  comment={comment}
  onResolve={onResolve}
  onReply={onReply}
  isSelected={selectedCommentId === comment.id}
  onClick={() => onSelectComment(comment.id)}
  sessionUser={sessionUser}
/>
```

- [ ] **Step 5: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds. TypeScript errors may appear in the design page because `handleAddComment` and `handleReply` signatures changed — these will be fixed in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/components/comments/
git commit -m "feat: thread sessionUser through comment components for auto-fill"
```

---

## Task 9: Auto-Fill Author — Design Page Integration

**Files:**
- Modify: `src/app/project/[projectId]/design/[designId]/page.tsx`

- [ ] **Step 1: Construct sessionUser and pass to components**

The page already imports `useSession` and calls `const { data: session } = useSession();`.

After the `session` destructuring, add:

```typescript
const sessionUser = session?.user
  ? { id: session.user.id, name: session.user.name ?? undefined, username: (session.user as any).username ?? undefined }
  : undefined;
```

- [ ] **Step 2: Update handleAddComment to accept authorId**

Change `handleAddComment`:
```typescript
const handleAddComment = async (
  x: number,
  y: number,
  content: string,
  authorName: string,
  authorId?: string
) => {
  await fetch(`/api/designs/${designId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ xPercent: x, yPercent: y, content, authorName, ...(authorId ? { authorId } : {}) }),
  });
  setIsAddMode(false);
  fetchDesign();
};
```

- [ ] **Step 3: Update handleReply to accept authorId**

```typescript
const handleReply = async (
  commentId: string,
  content: string,
  authorName: string,
  authorId?: string
) => {
  await fetch(`/api/comments/${commentId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, authorName, ...(authorId ? { authorId } : {}) }),
  });
  fetchDesign();
};
```

- [ ] **Step 4: Pass sessionUser to PinLayer and CommentSidebar**

In the JSX, pass `sessionUser` to PinLayer (both in the IMAGE and MARKDOWN branches):
```tsx
<PinLayer
  comments={design.comments || []}
  selectedCommentId={selectedCommentId}
  onSelectComment={setSelectedCommentId}
  onAddComment={handleAddComment}
  isAddMode={isAddMode}
  sessionUser={sessionUser}
/>
```

Pass to CommentSidebar:
```tsx
<CommentSidebar
  comments={design.comments || []}
  onResolve={handleResolve}
  onReply={handleReply}
  selectedCommentId={selectedCommentId}
  onSelectComment={setSelectedCommentId}
  mobileOpen={commentSidebarOpen}
  onMobileClose={() => setCommentSidebarOpen(false)}
  sessionUser={sessionUser}
/>
```

- [ ] **Step 5: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/app/project/[projectId]/design/[designId]/page.tsx
git commit -m "feat: pass sessionUser to comment components, auto-fill author"
```

---

## Task 10: LineGutter Component

**Files:**
- Create: `src/components/comments/LineGutter.tsx`

- [ ] **Step 1: Create LineGutter component**

Create `src/components/comments/LineGutter.tsx`:

```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AnchorResult } from "@/lib/anchor";
import { resolveAnchor } from "@/lib/anchor";

interface LineGutterProps {
  markdownContent: string;
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (line: number) => void;
  isAddMode: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

type ResolvedComment = {
  comment: any;
  anchor: AnchorResult;
};

export default function LineGutter({
  markdownContent,
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  isAddMode,
  contentRef,
}: LineGutterProps) {
  const [lineElements, setLineElements] = useState<Map<number, HTMLElement>>(new Map());
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Resolve comment anchors against current content
  const resolvedComments: ResolvedComment[] = comments
    .filter((c: any) => c.anchorLine != null)
    .map((c: any) => ({
      comment: c,
      anchor: resolveAnchor(c, markdownContent),
    }));

  // Build line-to-element mapping from data-source-line attributes
  useEffect(() => {
    if (!contentRef.current) return;

    const map = new Map<number, HTMLElement>();
    const elements = contentRef.current.querySelectorAll("[data-source-line]");
    elements.forEach((el) => {
      const startLine = parseInt(el.getAttribute("data-source-line") || "0", 10);
      const endLine = parseInt(el.getAttribute("data-source-end") || String(startLine), 10);
      for (let line = startLine; line <= endLine; line++) {
        if (!map.has(line)) {
          map.set(line, el as HTMLElement);
        }
      }
    });
    setLineElements(map);
  }, [markdownContent, contentRef]);

  const totalLines = markdownContent.split("\n").length;

  // Get comments at a specific line
  const commentsAtLine = useCallback(
    (line: number) =>
      resolvedComments.filter(
        (rc) => rc.anchor.confidence !== "orphaned" && rc.anchor.line === line
      ),
    [resolvedComments]
  );

  const handleLineClick = (line: number) => {
    if (isAddMode) {
      onAddComment(line);
    }
  };

  const scrollToLine = (line: number) => {
    const el = lineElements.get(line);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-yellow-100");
      setTimeout(() => el.classList.remove("bg-yellow-100"), 1500);
    }
  };

  return (
    <div ref={gutterRef} className="select-none" style={{ minWidth: "2.5rem" }}>
      {Array.from({ length: totalLines }, (_, i) => {
        const line = i + 1;
        const lineComments = commentsAtLine(line);
        const hasComments = lineComments.length > 0;

        return (
          <div
            key={line}
            className={`relative flex items-center justify-end pr-1 text-xs leading-6 ${
              isAddMode ? "cursor-pointer hover:bg-indigo-50" : ""
            } ${hoveredLine === line ? "bg-indigo-50" : ""}`}
            style={{ height: "1.5rem" }}
            onMouseEnter={() => setHoveredLine(line)}
            onMouseLeave={() => setHoveredLine(null)}
            onClick={() => handleLineClick(line)}
          >
            {hasComments ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectComment(lineComments[0].comment.id);
                  scrollToLine(line);
                }}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  lineComments[0].comment.resolved ? "bg-green-500" : "bg-indigo-600"
                } ${
                  selectedCommentId === lineComments[0].comment.id ? "ring-2 ring-red-400" : ""
                }`}
                title={`Pin #${lineComments[0].comment.pinNumber}`}
              >
                {lineComments[0].comment.pinNumber}
              </button>
            ) : isAddMode && hoveredLine === line ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                +
              </span>
            ) : (
              <span className="text-gray-300">{line}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds (component not yet used in any page).

- [ ] **Step 3: Commit**

```bash
git add src/components/comments/LineGutter.tsx
git commit -m "feat: add LineGutter component for markdown comment anchoring"
```

---

## Task 11: MarkdownViewer — Support LineGutter Layout

**Files:**
- Modify: `src/components/design/MarkdownViewer.tsx`

- [ ] **Step 1: Add a content ref and expose it via forwardRef or callback**

Refactor MarkdownViewer to accept an optional `contentRef` prop and wrap the article in a ref'd container:

Update the interface:
```typescript
interface MarkdownViewerProps {
  content: string;
  children?: React.ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
}
```

Update the component signature:
```typescript
export default function MarkdownViewer({ content, children, contentRef }: MarkdownViewerProps) {
```

Wrap the `<article>` in a `<div ref={contentRef}>`:
```tsx
<div ref={contentRef}>
  <article className="prose prose-gray ...">
    <ReactMarkdown ...>
      {content}
    </ReactMarkdown>
  </article>
</div>
```

Keep the existing `{children}` overlay at the end.

- [ ] **Step 2: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/design/MarkdownViewer.tsx
git commit -m "feat: add contentRef prop to MarkdownViewer for line mapping"
```

---

## Task 12: Design Page — Wire Up LineGutter for Markdown Designs

**Files:**
- Modify: `src/app/project/[projectId]/design/[designId]/page.tsx`

- [ ] **Step 1: Import LineGutter and add state/refs**

Add imports:
```typescript
import LineGutter from "@/components/comments/LineGutter";
import { computeAnchor } from "@/lib/anchor";
```

Add ref:
```typescript
const markdownContentRef = useRef<HTMLDivElement>(null);
```

- [ ] **Step 2: Add handleAddMarkdownComment function**

```typescript
const handleAddMarkdownComment = async (line: number) => {
  // Open a sidebar form instead of floating form
  // Store the pending anchor line, show the sidebar comment form
  setPendingAnchorLine(line);
};
```

Add state:
```typescript
const [pendingAnchorLine, setPendingAnchorLine] = useState<number | null>(null);
```

Add a `handleSubmitMarkdownComment` function that computes anchor and POSTs:

```typescript
const handleSubmitMarkdownComment = async (content: string, authorName: string, authorId?: string) => {
  if (pendingAnchorLine === null) return;
  const mdContent = viewingVersion?.content || design.content || "";
  const anchor = computeAnchor(pendingAnchorLine, mdContent);

  await fetch(`/api/designs/${designId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      anchorLine: anchor.anchorLine,
      anchorHeading: anchor.anchorHeading,
      anchorContext: anchor.anchorContext,
      contextBefore: anchor.contextBefore,
      contextAfter: anchor.contextAfter,
      content,
      authorName,
      ...(authorId ? { authorId } : {}),
    }),
  });
  setPendingAnchorLine(null);
  setIsAddMode(false);
  fetchDesign();
};
```

- [ ] **Step 3: Replace PinLayer with LineGutter for MARKDOWN designs**

In the JSX, change the MARKDOWN branch from:
```tsx
<MarkdownViewer
  content={viewingVersion?.content || design.content || ""}
>
  <PinLayer ... />
</MarkdownViewer>
```

To:
```tsx
<div className="flex h-full">
  <LineGutter
    markdownContent={viewingVersion?.content || design.content || ""}
    comments={design.comments || []}
    selectedCommentId={selectedCommentId}
    onSelectComment={setSelectedCommentId}
    onAddComment={handleAddMarkdownComment}
    isAddMode={isAddMode}
    contentRef={markdownContentRef}
  />
  <div className="flex-1 overflow-auto">
    <MarkdownViewer
      content={viewingVersion?.content || design.content || ""}
      contentRef={markdownContentRef}
    />
  </div>
</div>
```

Also, add a simple inline form or sidebar form for `pendingAnchorLine`. Add to the CommentSidebar area or add a floating form:

```tsx
{pendingAnchorLine !== null && (
  <div className="fixed bottom-4 left-4 z-50 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
    <p className="mb-2 text-xs text-gray-500">Commenting on line {pendingAnchorLine}</p>
    <CommentForm
      position={{ x: 0, y: 0 }}
      onSubmit={handleSubmitMarkdownComment}
      onCancel={() => setPendingAnchorLine(null)}
      sessionUser={sessionUser}
    />
  </div>
)}
```

Wait — CommentForm uses absolute positioning based on position. We need to override that for the markdown case. Instead, create a simpler inline form or position it differently. The quickest approach: wrap CommentForm in a container that overrides the absolute positioning, or render a simpler form. Let's use a fixed-position panel:

Actually, looking at CommentForm more carefully, it positions itself using `left/top` percentages. For the markdown anchor case, let's just use a fixed overlay panel with a simple textarea instead of the positioned CommentForm. We can reuse CommentForm but we need to handle the fact that its position prop doesn't make sense for markdown. The simplest fix: make CommentForm accept an optional `style` override, or just create the form inline.

For simplicity, render a small form panel directly:

```tsx
{pendingAnchorLine !== null && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-80 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-medium text-indigo-600">Line {pendingAnchorLine}</span>
      <button onClick={() => setPendingAnchorLine(null)} className="text-gray-400 hover:text-gray-600">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
    <MarkdownCommentForm
      onSubmit={handleSubmitMarkdownComment}
      onCancel={() => setPendingAnchorLine(null)}
      sessionUser={sessionUser}
    />
  </div>
)}
```

We need a variant of CommentForm without position-based styling. Create a simple inline version or refactor CommentForm. The cleanest approach: make CommentForm's position prop optional and skip absolute positioning when omitted.

- [ ] **Step 4: Make CommentForm position optional**

In `src/components/comments/CommentForm.tsx`, update the interface:
```typescript
interface CommentFormProps {
  position?: { x: number; y: number };
  onSubmit: (content: string, authorName: string, authorId?: string) => void;
  onCancel: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}
```

Update the JSX: if `position` is provided, use absolute positioning; otherwise, render as a normal flow element:
```tsx
<div
  ref={formRef}
  className={`${position ? 'absolute z-30' : ''} w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl`}
  style={position ? {
    left: `${position.x}%`,
    top: `${position.y}%`,
    marginLeft: `${offsetX}px`,
    marginTop: `${offsetY}px`,
  } : undefined}
  onClick={(e) => e.stopPropagation()}
>
```

Only compute `offsetX`/`offsetY` when position exists:
```typescript
const offsetX = position ? (position.x > 70 ? -280 : 20) : 0;
const offsetY = position ? (position.y > 70 ? -200 : 20) : 0;
```

- [ ] **Step 5: Use CommentForm without position for markdown anchor**

In the design page, for the pending anchor form:
```tsx
{pendingAnchorLine !== null && (
  <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
    <div className="mb-1 text-center">
      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
        Commenting on line {pendingAnchorLine}
      </span>
    </div>
    <CommentForm
      onSubmit={handleSubmitMarkdownComment}
      onCancel={() => setPendingAnchorLine(null)}
      sessionUser={sessionUser}
    />
  </div>
)}
```

Import CommentForm at the top of the design page:
```typescript
import CommentForm from "@/components/comments/CommentForm";
```

- [ ] **Step 6: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/app/project/[projectId]/design/[designId]/page.tsx src/components/comments/CommentForm.tsx
git commit -m "feat: wire up LineGutter for MARKDOWN designs with anchor-based commenting"
```

---

## Task 13: CommentSidebar — Show Anchor Info for Markdown Comments

**Files:**
- Modify: `src/components/comments/CommentThread.tsx`
- Modify: `src/components/comments/CommentSidebar.tsx`

- [ ] **Step 1: Update CommentThread to show anchor info**

In `src/components/comments/CommentThread.tsx`, add anchor display below the author/date line.

After the author name + date div, add:

```tsx
{comment.anchorLine != null && (
  <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
    <span>Line {comment.anchorLine}</span>
    {comment.anchorHeading && (
      <span className="text-gray-300">· {comment.anchorHeading}</span>
    )}
  </div>
)}
```

- [ ] **Step 2: Add scroll-to-line support in CommentSidebar**

In `src/components/comments/CommentSidebar.tsx`, accept an optional `onScrollToLine` prop:

```typescript
interface CommentSidebarProps {
  // ... existing props ...
  sessionUser?: { id: string; name?: string; username?: string };
  onScrollToComment?: (commentId: string) => void;
}
```

When a comment with `anchorLine` is clicked, call `onScrollToComment` in addition to `onSelectComment`:

```tsx
<CommentThread
  key={comment.id}
  comment={comment}
  onResolve={onResolve}
  onReply={onReply}
  isSelected={selectedCommentId === comment.id}
  onClick={() => {
    onSelectComment(comment.id);
    if (comment.anchorLine != null && onScrollToComment) {
      onScrollToComment(comment.id);
    }
  }}
  sessionUser={sessionUser}
/>
```

- [ ] **Step 3: Wire up scroll-to-line in the design page**

In the design page, pass `onScrollToComment` to CommentSidebar that finds the comment's resolved line and scrolls to it:

```typescript
const handleScrollToComment = (commentId: string) => {
  const comment = design.comments?.find((c: any) => c.id === commentId);
  if (!comment?.anchorLine || !markdownContentRef.current) return;

  const el = markdownContentRef.current.querySelector(
    `[data-source-line="${comment.anchorLine}"]`
  );
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    (el as HTMLElement).classList.add("bg-yellow-100");
    setTimeout(() => (el as HTMLElement).classList.remove("bg-yellow-100"), 1500);
  }
};
```

Pass it to CommentSidebar:
```tsx
<CommentSidebar
  ...
  onScrollToComment={design?.type === "MARKDOWN" ? handleScrollToComment : undefined}
/>
```

- [ ] **Step 4: Verify build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/comments/CommentThread.tsx src/components/comments/CommentSidebar.tsx src/app/project/[projectId]/design/[designId]/page.tsx
git commit -m "feat: show anchor info in sidebar and scroll to anchored lines"
```

---

## Task 14: Fix Existing Tests for Schema Changes

**Files:**
- Modify: `tests/designs.test.ts`
- Modify: `tests/exports.test.ts`

- [ ] **Step 1: Update comment creation in tests to include explicit position**

Search existing tests for comment creation that uses `xPercent`/`yPercent` and ensure they all pass explicit values (they should already since the schema previously required them, but verify).

Run: `grep -n "xPercent\|yPercent\|comment.create" tests/designs.test.ts tests/exports.test.ts`

Update any broken tests to use the new helpers or pass explicit xPercent/yPercent values.

- [ ] **Step 2: Run the full test suite**

Run: `cd /home/aayush/code/DesignForge && npx vitest run 2>&1 | tail -40`

Expected: All tests pass.

- [ ] **Step 3: Fix any failures**

If tests fail due to null xPercent/yPercent in `.toFixed()` calls from export functions, those should already be fixed by Task 5. If other failures exist, fix them.

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "fix: update tests for nullable xPercent/yPercent schema"
```

---

## Task 15: Final Integration Test and Verification

**Files:**
- Run all tests
- Verify build

- [ ] **Step 1: Run the full test suite**

Run: `cd /home/aayush/code/DesignForge && npx vitest run 2>&1`

Expected: All tests pass.

- [ ] **Step 2: Run the build**

Run: `cd /home/aayush/code/DesignForge && npx next build 2>&1 | tail -30`

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "chore: final fixes for integration"
```

- [ ] **Step 4: Summary commit message**

Review all commits with `git log --oneline -20` to confirm the feature set is complete:
1. Schema changes (nullable positions, anchor fields)
2. Anchor resolution library with tests
3. Remark source-line plugin
4. Comment API accepting anchor fields + authorId
5. Export null-safety
6. Confluence copy button (ExportDialog + design page)
7. Auto-fill author (component chain + design page)
8. LineGutter component
9. MarkdownViewer contentRef
10. Design page wiring (LineGutter, anchor commenting, sidebar scroll)
11. Test fixes
