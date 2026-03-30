# DesignForge — Agent Instructions

## Project Overview

DesignForge is a self-hosted design review platform. Teams upload designs (images + Markdown), pin comments directly on them, collaborate asynchronously with threaded replies and version history, and back up to GitHub.

## Tech Stack

- **Framework:** Next.js 16 (App Router) + React 19
- **Language:** TypeScript 5 (strict)
- **Database:** SQLite via Prisma 6
- **Auth:** NextAuth.js v5 (credentials + HTTP Basic Auth for CLI)
- **Styling:** Tailwind CSS v4
- **Testing:** Vitest
- **Markdown:** react-markdown + remark-gfm + rehype plugins
- **Diagrams:** Mermaid (client + server-side via @mermaid-js/mermaid-cli)
- **Export:** Markdown, HTML, Word (docx), Confluence
- **Backup:** GitHub REST API (supports GitHub Enterprise)

## Next.js 16 Warning

This project uses **Next.js 16** which has breaking changes from earlier versions. APIs, conventions, and file structure may differ from training data. Check actual project code before assuming patterns.

## Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server (localhost:3000) |
| `npm run build` | Production build |
| `npm start` | Run production build |
| `npm test` | Run Vitest tests once |
| `npm run test:watch` | Watch mode tests |
| `npm run lint` | ESLint |
| `npx prisma db push` | Sync schema to SQLite |
| `npx prisma studio` | Visual DB browser |

## Project Structure

```
src/
  app/                  # Next.js App Router pages + API routes
    api/                # REST API (designs, comments, folders, projects, admin, auth, uploads)
    admin/              # Admin backup/restore page
    dashboard/          # Project listing
    project/[projectId]/design/[designId]/  # Design viewer
  components/
    design/             # ImageViewer, MarkdownViewer, VersionHistory, DesignCard, etc.
    comments/           # PinLayer, CommentSidebar, CommentThread, CommentForm, etc.
    layout/             # Header, Sidebar, ThemeProvider
    project/            # ProjectCard, CreateProjectDialog
    share/              # ShareDialog, PasswordGate
    export/             # ExportDialog
  lib/
    auth.ts             # NextAuth config
    apiAuth.ts          # Unified auth (session + Basic Auth)
    db.ts               # Prisma singleton
    ownership.ts        # Folder/design permission checks
    admin.ts            # Admin check + backup config
    anchor.ts           # Comment anchor computation
    basePath.ts         # Base path helper for API/nav
    backup/             # GitHub backup: serialize, deserialize, scheduler
    export/             # Confluence, HTML, Markdown, Word exporters
  types/index.ts        # Global TypeScript types
prisma/schema.prisma    # DB schema (User, Project, Folder, Design, DesignVersion, Comment, Reply, ShareLink)
tests/                  # Vitest test suite
bin/cli.js              # CLI wrapper (prisma setup + npm start)
uploads/                # User-uploaded files (runtime)
```

## Key Patterns

- **Auth:** All API routes use `authenticateRequest()` from `src/lib/apiAuth.ts` (supports session + Basic Auth)
- **Ownership:** Folder/design access enforced via `src/lib/ownership.ts` — always check before mutations
- **Base path:** Use `apiUrl()` from `src/lib/basePath.ts` for all API calls (reverse proxy support)
- **Admin:** Single admin user set via `ADMIN_USERNAME` env var — exclusive privileges for project CRUD, backup/restore
- **Comment anchoring:** Text-based anchors (`anchorText`, `anchorLine`, `anchorHeading`) with fallback to `xPercent/yPercent` for images
- **Dark mode:** ThemeProvider + system preference detection
- **Components:** Use `"use client"` directive for interactive components

## Environment Variables

Required: `NEXTAUTH_SECRET`, `DATABASE_URL` (default: `file:./dev.db`)
Optional: `NEXTAUTH_URL`, `NEXT_PUBLIC_BASE_PATH`, `UPLOAD_DIR`, `ADMIN_USERNAME`, `GITHUB_BACKUP_*`, `BACKUP_SCHEDULE_CRON`

## Testing

Tests live in `tests/` using Vitest with a separate SQLite test database. File parallelism is disabled. Test helpers in `tests/helpers.ts`, setup in `tests/setup.ts`.
