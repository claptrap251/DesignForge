# DesignForge Enhancements: Mermaid Rendering, Confluence Export, Username Auth

**Date:** 2026-03-23
**Status:** Approved

## Overview

Three independent enhancements to DesignForge:

1. **Bulletproof mermaid-to-SVG rendering** -- replace the fragile jsdom-based renderer with `@mermaid-js/mermaid-cli` (headless Chromium) so all exports produce real SVGs without fallbacks.
2. **Confluence export quality** -- render markdown as formatted HTML (not code blocks) and ensure mermaid diagrams display as inline SVGs in Confluence storage format.
3. **Username-based authentication** -- replace email-based login with username + password. Email becomes an optional profile field.

---

## 1. Bulletproof Mermaid Rendering

### Problem

The current jsdom-based mermaid renderer (`src/lib/export/mermaid-utils.ts`) is fundamentally fragile. jsdom does not fully support SVG APIs, requiring extensive stubs for `matchMedia`, `ResizeObserver`, `IntersectionObserver`, and various SVG element methods. Despite these stubs, rendering consistently fails and falls back to raw mermaid code in exports. This affects all export formats (HTML, DOCX, Confluence).

### Solution

Replace the jsdom renderer with `@mermaid-js/mermaid-cli`, which provides the `mmdc` binary. `mmdc` spawns headless Chromium to render mermaid code in a real browser environment, producing correct SVG/PNG output for all diagram types.

### Changes

**New dependencies:**
- `@mermaid-js/mermaid-cli` (provides `mmdc` binary with bundled Chromium)
- `marked` (explicit dependency -- currently only a transitive dep but used directly in `html.ts` and `mermaid-utils.ts`)

**Dependencies removed:**
- `jsdom` and `@types/jsdom` -- no longer needed for mermaid rendering
- Remove dynamic `import("sharp")` from `mermaid-utils.ts` -- `mmdc` outputs PNG natively via `mmdc -e png`

Note: `sharp` is not in `package.json` (it was a dynamic import), so no package.json removal needed -- just remove the import from `mermaid-utils.ts`.

**Rewrite `src/lib/export/mermaid-utils.ts`:**

| Function | Current | New |
|----------|---------|-----|
| `renderMermaidToSvg(code, id)` | jsdom + mermaid singleton with mutex | Write code to temp `.mmd` file, invoke `mmdc -i input.mmd -o output.svg -e svg`, read SVG, clean up temps |
| `renderMermaidToPng(code, id)` | Render SVG via jsdom, convert to PNG via sharp | Write code to temp `.mmd` file, invoke `mmdc -i input.mmd -o output.png -e png`, read PNG buffer, clean up temps |
| `ensureMermaidDom()` | Creates jsdom with extensive stubs | **Removed** |
| `ensureDomGlobals()` | Patches global with jsdom | **Removed** |
| Render mutex | Serializes renders due to mermaid singleton | **Removed** -- separate CLI processes handle concurrency |
| `containsMermaid(content)` | Regex detection | **Unchanged** |
| `extractMermaidBlocks(content)` | Regex extraction | **Unchanged** |
| `markdownToHtmlWithMermaidSvg(content)` | Calls renderMermaidToSvg, returns `{ html, needsFallback }` | Calls renderMermaidToSvg (new impl). Remove `needsFallback` from return type -- always succeeds now. Return `string` (just the HTML). All callers in `html.ts` that destructure `needsFallback` must be updated. |
| `markdownToHtmlWithMermaid(content)` | Client-side rendering (raw mermaid divs) | **Removed** -- no longer needed since server-side rendering is reliable. Tests in `exports.test.ts` that import/use this function must be removed. |

**Error handling:**
- If `mmdc` fails for a specific diagram (e.g., syntax error in mermaid code), log the error and return a styled error placeholder: `<div style="background:#f3f4f6;border:1px solid #e5e7eb;padding:16px;border-radius:8px;color:#6b7280;font-style:italic">Diagram render error: [message]</div>`
- The export function itself never throws due to a mermaid rendering failure.

**HTML export (`src/lib/export/html.ts`):**
- Remove the `MERMAID_SCRIPT` CDN fallback constant and all `needsFallback` conditional logic.
- Update `renderDesignContentHtml()` to match the new `markdownToHtmlWithMermaidSvg()` return type (string, not `{ html, needsFallback }`).
- All mermaid content is pre-rendered as inline SVGs.

**MarkdownViewer component (`src/components/design/MarkdownViewer.tsx`):**
- No changes. This component uses client-side mermaid rendering (`mermaid.render()` in `useEffect`) for the live in-app viewer. Client-side rendering is appropriate here since the browser has full DOM support. The `mmdc` changes only affect the server-side export pipeline.

**Dockerfile:**
- The current `node:20-alpine` base image does not include the system libraries Chromium needs (glibc, libx11, etc.). Switch to `node:20-slim` (Debian-based, smaller than full `node:20` but includes necessary libs) or add Chromium system deps to Alpine via `apk add chromium nss freetype harfbuzz ca-certificates ttf-freefont` and set `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`.
- Also copy `node_modules/@mermaid-js` into the runner stage so `mmdc` is available at runtime.

### Interface

The public API of `renderMermaidToSvg` and `renderMermaidToPng` is unchanged (same arguments, same return types). Callers in `html.ts`, `docx.ts`, and `confluence.ts` require no changes to their rendering calls.

---

## 2. Confluence Export Quality

### Problem

The current Confluence export (`src/lib/export/confluence.ts`) has two issues:
1. Non-mermaid markdown text is wrapped in `ac:structured-macro ac:name="code"` (code blocks), displaying raw markdown syntax instead of formatted text.
2. Mermaid diagrams always fall back to raw code blocks because the jsdom renderer fails.

### Solution

1. Use `marked` (added as an explicit dependency in Section 1) to convert markdown text to HTML, then wrap in `ac:structured-macro ac:name="html"` so Confluence renders it as formatted content.
2. With the `mmdc`-based renderer from Section 1, mermaid SVG rendering will succeed. The existing HTML macro wrapping pattern is correct.

### Changes

**Rewrite `renderDesignContentConfluence()` in `src/lib/export/confluence.ts`:**

- **Non-mermaid markdown text:** Convert via `marked.parse()` to HTML, then wrap in:
  ```xml
  <ac:structured-macro ac:name="html">
    <ac:plain-text-body><![CDATA[<rendered HTML>]]></ac:plain-text-body>
  </ac:structured-macro>
  ```

- **Mermaid diagrams:** Render via `renderMermaidToSvg()` (now reliable), wrap in:
  ```xml
  <ac:structured-macro ac:name="html">
    <ac:plain-text-body><![CDATA[<div style="display:flex;justify-content:center;padding:16px"><SVG></div>]]></ac:plain-text-body>
  </ac:structured-macro>
  ```

- **Error case for mermaid:** If a specific diagram fails, embed the error placeholder in an HTML macro rather than falling back to a code block.

- **Comment table:** No changes. The existing format with `ac:structured-macro ac:name="status"` badges is correct Confluence markup.

### What doesn't change

- The export API routes (`src/app/api/export/[projectId]/route.ts` and `src/app/api/designs/[id]/export/route.ts`) -- same endpoints, same response format. Both routes call the same underlying export functions (`exportToConfluence`, `exportDesignToConfluence`, etc.) which are where the actual changes happen.
- The ExportDialog component -- same UI.

---

## 3. Username-Based Authentication

### Problem

Currently users register and log in with email + password. The requirement is to make email optional and use a strict username as the primary identity.

### Schema Change

```prisma
model User {
  id           String    @id @default(cuid())
  username     String    @unique       // NEW: primary login identifier
  email        String?                 // CHANGED: optional, no longer @unique
  name         String?                 // display name (unchanged)
  passwordHash String
  createdAt    DateTime  @default(now())
  projects     Project[]
  comments     Comment[]
  replies      Reply[]
}
```

Since this is a fresh database (no existing users), the migration is a simple `prisma db push` or a new migration that creates the table with the new schema.

### Username Validation

- **Length:** 3-39 characters
- **Characters:** Alphanumeric, hyphens, underscores only (`/^[a-zA-Z0-9_-]+$/`)
- **Restrictions:** Cannot start or end with a hyphen
- **Uniqueness:** Case-insensitive (stored as lowercase)

### Auth Configuration (`src/lib/auth.ts`)

- Credentials provider fields change from `email`/`password` to `username`/`password`
- `authorize()` looks up user by `username` (case-insensitive via `username: credentials.username.toLowerCase()`)
- JWT callback stores `username` on token
- Session callback exposes `username` on `session.user`

### Registration

**API (`src/app/api/auth/register/route.ts`):**
- Accepts: `{ username, password, name?, email? }`
- Validates username format (regex + length + no leading/trailing hyphens)
- Stores `username` as lowercase
- Checks uniqueness on lowercase username
- Returns: `{ id, username, name }`

**UI (`src/app/(auth)/register/page.tsx`):**
- Form fields: Username (required), Password (required, min 6 chars), Display Name (optional), Email (optional)
- Username field shows validation hints (format requirements)
- Auto-login after registration uses username + password

### Login

**UI (`src/app/(auth)/login/page.tsx`):**
- Email field replaced with Username field
- Submits username + password to `signIn("credentials", ...)`

### Downstream Impact

- `Comment.authorName` / `Reply.authorName` -- plain strings, no schema change. When creating comments, the system uses `session.user.name || session.user.username` as the author name.
- The session type needs extending to include `username` (update `src/types/index.ts` or NextAuth type declarations).
- `src/components/layout/Header.tsx` -- currently shows `session.user?.name || session.user?.email`. Update fallback to `session.user?.name || session.user?.username` since email may now be undefined.

---

## 4. Testing Strategy

### Mermaid Rendering Tests (`tests/exports.test.ts`)

- **SVG rendering:** Verify `renderMermaidToSvg()` produces valid SVG output (contains `<svg` tag) for flowchart, sequence, gantt, and class diagrams.
- **PNG rendering:** Verify `renderMermaidToPng()` produces valid PNG buffer (magic bytes `\x89PNG`).
- **Error handling:** Pass invalid mermaid syntax, verify error placeholder HTML is returned (not an exception).
- **Concurrent renders:** Call `renderMermaidToSvg()` multiple times concurrently, verify all produce valid output.
- **Remove:** Tests that import or use `markdownToHtmlWithMermaid` (the removed client-side function). Remove tests that relied on jsdom internals or mermaid singleton behavior.

### Confluence Export Tests

- **Text rendering:** Verify non-mermaid markdown is converted to HTML and wrapped in `ac:structured-macro ac:name="html"` (not `ac:name="code"`).
- **Diagram rendering:** Verify mermaid diagrams produce inline SVGs inside HTML macros.
- **Full pipeline:** Verify `exportToConfluence()` produces valid Confluence storage format with formatted text and rendered diagrams.

### Auth Tests (`tests/auth.test.ts`)

- **User creation:** Username + password, optional email and name.
- **Username uniqueness:** Case-insensitive -- creating "Aayush" and "aayush" should conflict.
- **Username validation:** Reject: too short (<3), too long (>39), spaces, special chars, leading/trailing hyphens. Accept: alphanumeric, underscores, hyphens (not at boundaries).
- **Login:** Correct username + password succeeds. Wrong password fails. Non-existent username fails.

---

## Files Changed

| File | Change |
|------|--------|
| `package.json` | Add `@mermaid-js/mermaid-cli`, `marked`. Remove `jsdom`, `@types/jsdom`. |
| `Dockerfile` | Switch to `node:20-slim` or add Chromium deps to Alpine. Copy `mmdc` into runner stage. |
| `prisma/schema.prisma` | Add `username` field, make `email` optional and non-unique. |
| `src/lib/export/mermaid-utils.ts` | Full rewrite: jsdom renderer -> mmdc CLI. Remove `markdownToHtmlWithMermaid`. Remove sharp import. |
| `src/lib/export/html.ts` | Remove CDN fallback, remove `needsFallback` logic. Update callers of `markdownToHtmlWithMermaidSvg`. |
| `src/lib/export/confluence.ts` | Render markdown as HTML (via `marked`) instead of code blocks. |
| `src/lib/auth.ts` | Login by username instead of email. Expose username in session. |
| `src/app/api/auth/register/route.ts` | Accept username, validate format, make email optional. |
| `src/app/(auth)/register/page.tsx` | Username field (required), email field (optional). |
| `src/app/(auth)/login/page.tsx` | Username field instead of email. |
| `src/components/layout/Header.tsx` | Update display name fallback from `email` to `username`. |
| `src/types/index.ts` | Add `username` to session user type. |
| `tests/exports.test.ts` | Update mermaid tests for mmdc-based rendering. Remove `markdownToHtmlWithMermaid` tests. Add Confluence quality tests. |
| `tests/auth.test.ts` | Add username validation and login tests. |
| `tests/helpers.ts` | Update `createTestUser` to use `username` (e.g., `test_${Date.now()}`) instead of `email`. |
