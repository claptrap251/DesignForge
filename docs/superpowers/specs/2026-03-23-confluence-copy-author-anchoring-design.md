# Design Spec: Confluence Copy, Auto-Author, and Comment Anchoring

**Date:** 2026-03-23
**Status:** Draft (Rev 2 — addresses spec review)

---

## Overview

Three improvements to DesignForge:

1. **Confluence copy button** — Let users copy raw Confluence storage format XML to clipboard, not just download an HTML file.
2. **Auto-fill comment author** — Use the logged-in user's name/username instead of asking for it. Keep free-text input for anonymous share-link viewers.
3. **Line-based comment anchoring** — For MARKDOWN designs, anchor comments to lines with heading path + context, so comments survive content edits. IMAGE designs keep xPercent/yPercent.

---

## Feature 1: Confluence Copy Button

### Problem

The Confluence export downloads a `.html` file. Users need to paste the raw Confluence storage format XML into Confluence's editor, but there's no easy way to get it onto the clipboard.

### Design

Add a "Copy Markup" button alongside the existing "Download .html" button. When clicked, it fetches the Confluence export via the existing API endpoint and writes the response text to the clipboard using `navigator.clipboard.writeText()`.

### Changes

**`src/components/export/ExportDialog.tsx`**
- When `format === "confluence"`, render two buttons side by side: "Download .html" (existing behavior) and "Copy Markup" (new, with a clipboard icon).
- "Copy Markup" calls `fetch(`/api/export/${projectId}?format=confluence`)`, reads the response as text, and writes to clipboard.
- Show brief "Copied!" feedback for 2 seconds after successful copy.
- **Error handling**: If `navigator.clipboard.writeText()` fails (e.g. permission denied, non-HTTPS context), show an inline error message "Copy failed — try downloading instead" for 3 seconds. No fallback text input needed since the download button is right there.

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- In the per-design export dropdown menu, add a "Copy Confluence" menu item alongside the existing "Confluence" download option.
- Same fetch + clipboard logic with the same error handling.
- Show a brief toast or inline "Copied!" indicator.

No backend changes required — the existing API endpoints already return the raw Confluence XML as `text/html`.

---

## Feature 2: Auto-Fill Comment Author from Session

### Problem

Logged-in users are asked to type their name every time they comment. The schema already has `authorId` (nullable FK to User) but it's never populated.

### Design

When a user is logged in, auto-fill `authorName` from their session (`name || username`) and set `authorId` to their user ID. Hide the name input field. For anonymous share-link viewers (no session), keep the existing free-text name input.

### Session User Structure

NextAuth v5 beta session object structure (verified from `src/lib/auth.ts` callbacks):
```ts
session.user = {
  id: string;        // user.id from the database
  name: string;      // user.name (set from profile)
  email?: string;    // user.email (nullable)
  username?: string;  // custom field added via session callback
}
```

The prop interface:
```ts
sessionUser?: { id: string; name?: string; username?: string }
```

### Data Flow

```
Design page (useSession) 
  → PinLayer (sessionUser prop) → CommentForm (sessionUser prop)
  → CommentSidebar (sessionUser prop) → CommentThread (sessionUser prop) → reply CommentForm
```

### Changes

**`src/components/comments/CommentForm.tsx`**
- Accept a new optional prop: `sessionUser?: { id: string; name?: string; username?: string }`.
- If `sessionUser` is provided, hide the name input and use `sessionUser.name || sessionUser.username` as the author name.
- If `sessionUser` is absent, keep the existing localStorage-backed free-text input.
- The `onSubmit` callback signature changes to include an optional `authorId`: `onSubmit(content: string, authorName: string, authorId?: string)`.

**`src/components/comments/CommentThread.tsx`**
- Accept `sessionUser` prop, pass it to the inline reply CommentForm.
- Pass `authorId` through the `onReply` callback: `onReply(commentId: string, content: string, authorName: string, authorId?: string)`.

**`src/components/comments/PinLayer.tsx`**
- Accept `sessionUser` prop, forward to CommentForm.

**`src/components/comments/CommentSidebar.tsx`**
- Accept `sessionUser` prop, forward to each CommentThread.

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- Fetch session via `useSession()` from `next-auth/react`.
- Construct `sessionUser` from `session.user` (if session exists).
- Pass `sessionUser` to PinLayer and CommentSidebar.
- When creating a comment or reply, include `authorId` in the POST body if session is available.

**`src/app/api/designs/[id]/comments/route.ts`**
- Accept optional `authorId` in the request body.
- If `authorId` is provided, include it in the `prisma.comment.create()` data.
- Keep `authorName` as required (always populated regardless of auth state).

**`src/app/api/comments/[id]/replies/route.ts`**
- Same: accept optional `authorId`, include in `prisma.reply.create()` if present.

**Schema**: No changes needed — `authorId` already exists as an optional field on both Comment and Reply.

**Share link pages** (`src/app/share/[token]/design/[designId]/page.tsx` and similar):
- These pages don't have a session, so `sessionUser` will be undefined and the name input remains visible.

---

## Feature 3: Line-Based Comment Anchoring for Markdown

### Problem

MARKDOWN design comments use `xPercent`/`yPercent` (percentage coordinates on the rendered output). When content is edited, the rendered layout changes and comments point to wrong locations.

### Design

For MARKDOWN designs, anchor comments to source lines using a three-tier resolution system: heading path, context snippet, and line number. IMAGE designs keep xPercent/yPercent unchanged.

### Schema Changes

Make `xPercent`/`yPercent` nullable and add five new nullable fields to Comment:

```prisma
model Comment {
  // ... existing fields ...
  // Position for IMAGE designs (now nullable)
  xPercent        Float?     // was Float (non-nullable)
  yPercent        Float?     // was Float (non-nullable)

  // Line-based anchoring for MARKDOWN designs
  anchorLine      Int?       // 1-based line number in markdown source
  anchorHeading   String?    // nearest heading (e.g. "## Process Flow"), just the closest one
  anchorContext   String?    // the exact line content at anchor point (trimmed)
  contextBefore   String?    // up to 2 lines before anchor (newline-joined, store what's available)
  contextAfter    String?    // up to 2 lines after anchor (newline-joined, store what's available)
}
```

IMAGE comments use xPercent/yPercent (both non-null). MARKDOWN comments use anchor fields (anchorLine non-null, xPercent/yPercent null). Fresh database — no migration needed, just update schema and regenerate.

**Validation rule**: The API enforces either (`xPercent` + `yPercent`) or `anchorLine`, never both and never neither.

### Anchor Creation (when a comment is placed)

When a user clicks a line in the LineGutter of a MARKDOWN design:

1. **`anchorLine`**: The 1-based line number in the markdown source.
2. **`anchorHeading`**: Walk backwards from the anchor line to find the nearest heading (`#`, `##`, etc.). Store the closest one as-is, e.g. `"## Process Flow"`. If multiple headings have the same text, just use whichever is nearest — this is context for humans, not a unique ID.
3. **`anchorContext`**: The exact text content of the anchor line, trimmed.
4. **`contextBefore`**: Up to 2 lines immediately before the anchor line, joined by `\n`. If fewer than 2 lines exist (e.g. anchor is line 1 or 2), store what's available. Whitespace-only lines are included.
5. **`contextAfter`**: Up to 2 lines immediately after the anchor line, joined by `\n`. Same edge-case handling.

This computation happens client-side before the POST request, using the raw markdown source string split by `\n`.

### Anchor Resolution (when displaying comments on possibly-edited content)

A new utility `src/lib/anchor.ts` provides:

```ts
type AnchorResult = {
  line: number;
  confidence: "exact" | "fuzzy" | "fallback" | "orphaned";
};

function resolveAnchor(comment: AnchorFields, currentContent: string): AnchorResult;
```

Resolution order:

1. **Heading + line match**: Find the heading (`anchorHeading`) in current content. If the heading exists and the relative offset from the heading matches the anchor line's offset, and the content at that line matches `anchorContext` (exact string equality after trim), return `exact`.

2. **Context fuzzy match**: Search the current content for a line matching `anchorContext` (exact string equality after trim). If found, verify by checking that `contextBefore`/`contextAfter` partially match the surrounding lines. "Match" means exact string equality after trimming. Require at least 1 of the stored before-lines matches one of the actual before-lines, OR at least 1 of the stored after-lines matches one of the actual after-lines. Return `fuzzy` with the new line number.

3. **Line number fallback**: If the original `anchorLine` is still within range of the document (1 ≤ anchorLine ≤ totalLines), return `fallback` with the original line number.

4. **Orphaned**: If the document is shorter than `anchorLine` and no context match was found, return `orphaned`. The comment appears in the sidebar but isn't pinned to any line.

### UI Changes for Markdown Designs

**New component: `src/components/comments/LineGutter.tsx`**
- Renders alongside the markdown content as a left-side gutter (flex row: gutter | content).
- Each source line gets a thin row. When `isAddMode` is true, hovering a row shows a "+" button.
- Clicking the "+" button anchors the comment to that line and opens the CommentForm in the sidebar (not floating like IMAGE comments). The sidebar CommentForm is pre-populated with the anchor line context.
- Existing comments show their pin number badge in the gutter at their resolved line.
- Orphaned comments do NOT appear in the gutter (no line to attach to).

**`src/components/design/MarkdownViewer.tsx`**
- Implement source-line mapping using a **custom remark plugin** that annotates each top-level AST node with `data-source-line` attributes. The plugin walks the remark AST, reads the `position.start.line` / `position.end.line` from each node (remark's parser already tracks these), and injects them as hProperties. This produces `<p data-source-line="5" data-source-end="7">...` in the rendered HTML.
- The LineGutter reads these `data-source-line` attributes to align gutter rows with rendered content.
- The PinLayer overlay with xPercent/yPercent pins is no longer used for MARKDOWN designs. PinLayer remains for IMAGE designs only.

**`src/components/comments/CommentSidebar.tsx`**
- For MARKDOWN designs, each CommentThread shows the anchor info: "Line N" + heading context (if available) + confidence indicator.
  - `exact`: no indicator (default state)
  - `fuzzy`: subtle "~" prefix, e.g. "~Line 42"
  - `fallback`: yellow dot indicator
  - `orphaned`: warning icon + message "This comment's location could not be found in the current content."
- Clicking a non-orphaned comment in the sidebar scrolls the markdown viewer to the anchored line and highlights it with a brief yellow flash.
- Clicking an orphaned comment does nothing (no scroll target). Users can still reply to orphaned comments and resolve/unresolve them.

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- When `design.type === "MARKDOWN"`: use LineGutter + line-based comment creation instead of PinLayer.
- When `design.type === "IMAGE"`: keep PinLayer with xPercent/yPercent (no change).
- The `handleAddComment` function computes anchor fields from the markdown source before POSTing.

### API Changes

**`POST /api/designs/[id]/comments`**
- Accept the new anchor fields alongside the existing position fields.
- For MARKDOWN designs, the frontend sends: `anchorLine`, `anchorHeading`, `anchorContext`, `contextBefore`, `contextAfter`, `content`, `authorName`, and optionally `authorId`. The `xPercent`/`yPercent` fields are omitted (null).
- For IMAGE designs, the frontend sends `xPercent`, `yPercent` as before.
- Validation: require either (`xPercent` + `yPercent`) or `anchorLine`. Not both, not neither. Return 400 on violation.

### Export Changes

All export functions currently show comment position as `(xPercent%, yPercent%)`. Update with null-safety:
- If `anchorLine` is set: show `Line ${anchorLine}` (and optionally the heading in parentheses if available).
- If `xPercent`/`yPercent` are set: show `(xPercent%, yPercent%)` as before.
- Null-safety: check for null before calling `.toFixed()`. Each export function (markdown.ts, html.ts, confluence.ts, docx.ts) needs this guard.

### Source-Line Mapping Strategy (Implementation Detail)

The approach uses a **custom remark plugin** rather than relying on `react-markdown` exposing `sourcePosition` directly. Here's the concrete strategy:

1. Create `src/lib/remarkSourceLines.ts` — a remark plugin that:
   - Walks the mdast (Markdown AST) tree after parsing
   - For each top-level node (paragraph, heading, code, list, blockquote, thematicBreak, table, html), reads `node.position.start.line` and `node.position.end.line` (remark's parser populates these by default)
   - Sets `node.data.hProperties = { 'data-source-line': startLine, 'data-source-end': endLine }` so they appear as HTML attributes in the rendered output

2. In `MarkdownViewer.tsx`, pass this plugin to `react-markdown`:
   ```tsx
   <ReactMarkdown remarkPlugins={[remarkGfm, remarkSourceLines]}>
   ```

3. The LineGutter component queries the rendered container for `[data-source-line]` elements to build the line-to-element mapping.

This piggybacks on remark's existing AST position tracking and requires no separate markdown parser. The plugin is ~30 lines of code.

---

## Testing

### Feature 1 (Confluence copy)
- Test that clicking "Copy Markup" puts the Confluence XML on the clipboard (mock `navigator.clipboard`).
- Test that the "Copied!" indicator appears and disappears.
- Test error state when clipboard write fails.
- Manual verification: paste into Confluence editor, confirm formatting.

### Feature 2 (Auto-author)
- Unit test: CommentForm with `sessionUser` prop renders no name input and passes correct authorName/authorId.
- Unit test: CommentForm without `sessionUser` shows name input and uses localStorage.
- Integration test: POST /api/designs/:id/comments with `authorId` stores it on the comment.
- Integration test: POST without `authorId` leaves it null.
- Integration test: POST /api/comments/:id/replies with `authorId` stores it on the reply.

### Feature 3 (Anchoring)
- **resolveAnchor unit tests**: exact match, fuzzy match (context shifted), fallback (content changed but line in range), orphaned (document shortened).
- **Anchor computation**: test `computeAnchor(lineNumber, markdownSource)` returns correct heading, context, and surrounding lines. Edge cases: line 1, last line, line after heading, line with no heading above.
- **Remark plugin**: test that `remarkSourceLines` adds `data-source-line` attributes to rendered elements.
- **API validation**: test 400 response when neither position type is provided, or both are provided.
- **Export null-safety**: test that exports handle null xPercent/yPercent gracefully and show "Line N" for markdown comments.
- **Integration**: create a markdown comment with anchor fields, verify stored; edit content, verify resolution finds the comment.
- **Regression**: IMAGE design comments still use xPercent/yPercent and are unaffected.

---

## Out of Scope

- Confluence API push (direct posting to Confluence) — export remains download/copy only.
- Multi-line comment ranges (highlighting a range of lines) — anchor is single-line only.
- Diff view showing comment movement between versions.
- Inline comment threading (comments appear inline in the markdown) — comments stay in the sidebar.
- Moving orphaned comments to new locations — they stay orphaned until content is restored or manually resolved.
