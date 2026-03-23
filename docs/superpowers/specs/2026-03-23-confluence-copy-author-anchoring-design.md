# Design Spec: Confluence Copy, Auto-Author, and Comment Anchoring

**Date:** 2026-03-23
**Status:** Draft

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

Add a "Copy Markup" button to both the project-level ExportDialog and the per-design export menu. When clicked, it fetches the Confluence export via the existing API endpoint and writes the response text to the clipboard using `navigator.clipboard.writeText()`.

### Changes

**`src/components/export/ExportDialog.tsx`**
- When `format === "confluence"`, show two buttons side by side: "Download .html" (existing behavior) and "Copy Markup".
- "Copy Markup" calls `fetch(`/api/export/${projectId}?format=confluence`)`, reads the response as text, and writes to clipboard.
- Show brief "Copied!" feedback for 2 seconds after successful copy.

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- In the per-design export dropdown menu, add a "Copy Confluence" option alongside the existing "Confluence" download option.
- Same fetch + clipboard logic. Show a brief toast or inline "Copied!" indicator.

No backend changes required — the existing API endpoints already return the raw Confluence XML as `text/html`.

---

## Feature 2: Auto-Fill Comment Author from Session

### Problem

Logged-in users are asked to type their name every time they comment. The schema already has `authorId` (nullable FK to User) but it's never populated.

### Design

When a user is logged in, auto-fill `authorName` from their session (`name || username`) and set `authorId` to their user ID. Hide the name input field. For anonymous share-link viewers (no session), keep the existing free-text name input.

### Changes

**`src/components/comments/CommentForm.tsx`**
- Accept a new optional prop: `sessionUser?: { id: string; name?: string; username?: string }`.
- If `sessionUser` is provided, hide the name input and use `sessionUser.name || sessionUser.username` as the author name.
- If `sessionUser` is absent, keep the existing localStorage-backed free-text input.
- The `onSubmit` callback signature changes to include an optional `authorId`: `onSubmit(content: string, authorName: string, authorId?: string)`.

**`src/components/comments/CommentThread.tsx`**
- Same pattern for the reply form: accept `sessionUser` prop, auto-fill author on replies.
- Pass `authorId` through the `onReply` callback.

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- Fetch session via `useSession()` from `next-auth/react`.
- Pass `sessionUser` to `CommentForm` (via PinLayer) and `CommentThread` (via CommentSidebar).
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

Add five nullable fields to the Comment model:

```prisma
model Comment {
  // ... existing fields ...
  // Line-based anchoring for MARKDOWN designs
  anchorLine      Int?       // 1-based line number in markdown source
  anchorHeading   String?    // nearest heading path, e.g. "## Process Flow"
  anchorContext   String?    // the exact line content at anchor point
  contextBefore   String?    // ~2 lines before anchor (newline-joined)
  contextAfter    String?    // ~2 lines after anchor (newline-joined)
}
```

These fields are null for IMAGE comments (which continue to use xPercent/yPercent). The existing xPercent/yPercent fields become nullable (they're unused for markdown comments going forward). Fresh database — no migration needed.

### Anchor Creation (when a comment is placed)

When a user clicks a line in a MARKDOWN design to comment:

1. **`anchorLine`**: The 1-based line number in the markdown source.
2. **`anchorHeading`**: Walk backwards from the anchor line to find the nearest heading (`#`, `##`, etc.). Store it as-is, e.g. `"## Process Flow"`.
3. **`anchorContext`**: The exact text content of the anchor line (trimmed).
4. **`contextBefore`**: The 2 lines immediately before the anchor line, joined by `\n`. If fewer than 2 lines exist, store what's available.
5. **`contextAfter`**: The 2 lines immediately after the anchor line, joined by `\n`.

This computation happens client-side before the POST request, using the raw markdown source string.

### Anchor Resolution (when displaying comments on possibly-edited content)

A new utility `src/lib/anchor.ts` provides `resolveAnchor(comment, currentContent) → { line: number; confidence: "exact" | "fuzzy" | "fallback" | "orphaned" }`.

Resolution order:

1. **Heading + line match**: Find the heading in current content. If the heading exists and the relative offset from the heading matches the anchor line's offset, and the content at that line matches `anchorContext`, return `exact`.

2. **Context fuzzy match**: Search the current content for a line matching `anchorContext`. If found, verify by checking that `contextBefore`/`contextAfter` partially match the surrounding lines (at least 1 of 2 lines match). Return `fuzzy` with the new line number.

3. **Line number fallback**: If the original `anchorLine` is still within range of the document, return `fallback` with the original line number.

4. **Orphaned**: If the document is shorter than `anchorLine` and no context match was found, return `orphaned`. The comment appears in the sidebar with a warning icon but isn't pinned to any line.

### UI Changes for Markdown Designs

**New component: `src/components/comments/LineGutter.tsx`**
- Renders alongside the markdown content as a left-side gutter.
- Each source line gets a thin row. When `isAddMode` is true, hovering a row shows a "+" button.
- Clicking the "+" button on a line opens the CommentForm anchored to that line.
- Existing comments show their pin number badge in the gutter at their resolved line.

**`src/components/design/MarkdownViewer.tsx`**
- Split the rendered markdown into line-addressable blocks. Each top-level rendered element (paragraph, heading, code block, list, etc.) maps back to its source line range.
- Wrap content in a container that pairs with LineGutter.
- The PinLayer overlay with xPercent/yPercent pins is no longer used for MARKDOWN designs. PinLayer remains for IMAGE designs only.

**`src/components/comments/CommentSidebar.tsx`**
- For MARKDOWN designs, each CommentThread shows the anchor line number and confidence indicator instead of position coordinates.
- Clicking a comment in the sidebar scrolls the markdown viewer to the anchored line and highlights it briefly.
- Orphaned comments show a warning: "This comment's location could not be found in the current content."

**`src/app/project/[projectId]/design/[designId]/page.tsx`**
- When `design.type === "MARKDOWN"`: use LineGutter + line-based comment creation instead of PinLayer.
- When `design.type === "IMAGE"`: keep PinLayer with xPercent/yPercent (no change).
- The `handleAddComment` function computes anchor fields from the markdown source before POSTing.

### API Changes

**`POST /api/designs/[id]/comments`**
- Accept the new anchor fields alongside the existing position fields.
- For MARKDOWN designs, the frontend sends: `anchorLine`, `anchorHeading`, `anchorContext`, `contextBefore`, `contextAfter`, `content`, `authorName`, and optionally `authorId`. The `xPercent`/`yPercent` fields are omitted (null).
- For IMAGE designs, the frontend sends `xPercent`, `yPercent` as before.
- Validation: require either (`xPercent` + `yPercent`) or `anchorLine`. Not both, not neither.

### Export Changes

All export functions currently show comment position as `(xPercent%, yPercent%)`. Update them:
- If `anchorLine` is set, show `Line ${anchorLine}` (and optionally the heading context).
- If only xPercent/yPercent is set, show the percentage position as before.
- Applies to: `markdown.ts`, `html.ts`, `confluence.ts`, `docx.ts`.

### Source-Line Mapping Strategy

The MarkdownViewer currently renders markdown via `react-markdown`. To map rendered elements back to source lines:

- Split the raw markdown source by `\n` into an array of lines.
- Use a custom `remark` plugin (or the AST position data that `remark` already provides) to track which source lines produced which rendered elements.
- `react-markdown` exposes `sourcePosition` on nodes when configured — each rendered element knows its start/end line in the source.
- The LineGutter uses this mapping to align gutter rows with rendered content.

This avoids re-implementing a markdown parser; we piggyback on remark's existing AST position tracking.

---

## Testing

### Feature 1 (Confluence copy)
- Test that clicking "Copy Markup" puts the Confluence XML on the clipboard.
- Test that the "Copied!" indicator appears and disappears.
- Manual verification: paste into Confluence editor, confirm formatting.

### Feature 2 (Auto-author)
- Unit test: CommentForm with `sessionUser` prop renders no name input and passes correct authorName/authorId.
- Unit test: CommentForm without `sessionUser` shows name input and uses localStorage.
- Integration test: POST /api/designs/:id/comments with `authorId` stores it on the comment.
- Integration test: POST without `authorId` leaves it null.

### Feature 3 (Anchoring)
- Unit test `resolveAnchor()` with exact match, fuzzy match, fallback, and orphaned scenarios.
- Unit test anchor field computation from markdown source string.
- Integration test: create a markdown comment with anchor fields, verify they're stored.
- Integration test: edit content, verify anchor resolution finds the comment at the right line.
- Test that IMAGE design comments still use xPercent/yPercent and are unaffected.
- Test exports show "Line N" for markdown comments and "(x%, y%)" for image comments.

---

## Out of Scope

- Confluence API push (direct posting to Confluence) — export remains download/copy only.
- Multi-line comment ranges (highlighting a range of lines) — anchor is single-line only.
- Diff view showing comment movement between versions.
- Inline comment threading (comments appear inline in the markdown) — comments stay in the sidebar.
