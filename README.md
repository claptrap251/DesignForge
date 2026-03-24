<h1 align="center">DesignForge</h1>

<p align="center">
  <strong>A self-hosted design review platform</strong><br/>
  Upload designs, pin comments directly on them, collaborate with your team — all running entirely on your own infrastructure with zero external dependencies.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#screenshots">Screenshots</a> &bull;
  <a href="#getting-started">Getting Started</a> &bull;
  <a href="#deployment">Deployment</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/next.js-16-black.svg" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/typescript-5-blue.svg" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/database-SQLite-green.svg" alt="SQLite" />
  <img src="https://img.shields.io/badge/self--hosted-100%25-purple.svg" alt="Self-hosted" />
</p>

---

## Features

- **Design uploads** — Drag-and-drop images (PNG, JPG, GIF, SVG, WebP) or upload/write Markdown documents
- **Text-anchored comments** — Comments lock to the word you click on, surviving zoom and resolution changes. If the anchored text is deleted, the comment is automatically marked as discarded
- **Threaded replies** — Reply to comments, resolve them, or delete with confirmation
- **Design status workflow** — Track designs through Draft, In Review, and Approved stages with filter pills
- **Version history** — Upload new versions while preserving comments per-version. Browse old versions to see the review state at any point. Create new versions from any historical version
- **Project organization** — Group designs into projects with nested folders and subfolders
- **Shareable links** — Generate share links with optional password protection and expiry dates
- **Export** — Export designs as Markdown, HTML, Word, or Confluence markup with rich comment context (expandable sections, line numbers, text snippets)
- **Dark mode** — Full dark mode with system preference detection and manual toggle
- **Configurable base path** — Deploy under any sub-path (e.g. `/design`) for reverse proxy setups
- **Fully local** — No external API calls, no CDNs, no analytics, no telemetry. Uses local SQLite, local file storage, and system fonts

## Screenshots

### Design Viewer with Comments
Pin comments on any word in your markdown documents. Comments anchor to text, not coordinates — they stay accurate across screen sizes.

![Design Viewer](docs/screenshots/design-viewer.png)

### Dark Mode
Full dark mode support across all surfaces, toggleable from the header.

![Dark Mode](docs/screenshots/dark-mode.png)

### Project Dashboard
Organize designs into projects. Each project card shows at a glance.

![Dashboard](docs/screenshots/dashboard.png)

### Folder View with Status Workflow
Designs are grouped by status (Draft / In Review / Approved) with filter pills.

![Project View](docs/screenshots/project.png)

### Login
Clean authentication with username/password. No external auth providers needed.

![Login](docs/screenshots/login.png)

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org/) (App Router) |
| **Language** | TypeScript 5 |
| **Database** | SQLite via [Prisma ORM](https://www.prisma.io/) |
| **Auth** | [NextAuth.js v5](https://authjs.dev/) with credentials provider (bcryptjs) |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) with [@tailwindcss/typography](https://github.com/tailwindlabs/tailwindcss-typography) |
| **Markdown** | [react-markdown](https://github.com/remarkjs/react-markdown) + remark-gfm + rehype-slug |
| **Diagrams** | [Mermaid](https://mermaid.js.org/) (client-side rendering + server-side SVG export via mmdc) |
| **File storage** | Local `uploads/` directory |
| **Export** | marked (HTML), docx (Word), Confluence storage format |

## Getting Started

### Prerequisites

- Node.js 18+ (20+ recommended)
- npm

### Quick Start

```bash
# Clone the repository
git clone https://github.com/claptrap251/DesignForge.git
cd DesignForge

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env and set NEXTAUTH_SECRET to a random string

# Initialize the database
npx prisma db push

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and register your first account.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `NEXTAUTH_SECRET` | Session encryption key (required) | — |
| `NEXTAUTH_URL` | App origin URL | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Trust the host header | `true` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |
| `NEXT_PUBLIC_BASE_PATH` | Serve under a sub-path (e.g. `/design`) | — |
| `NEXT_TELEMETRY_DISABLED` | Disable Next.js telemetry | `1` |

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Docker

```bash
docker compose up --build -d
```

The included `Dockerfile` builds a standalone Next.js image with Chromium for server-side mermaid diagram rendering.

### Reverse Proxy (Sub-path)

To serve DesignForge at `https://your-domain.com/design`:

1. Set `NEXT_PUBLIC_BASE_PATH="/design"` in `.env`
2. Rebuild: `npm run build`
3. Configure your reverse proxy to forward `/design` to the app

> **Note:** `NEXT_PUBLIC_BASE_PATH` is baked into the client bundle at build time. Changing it requires a rebuild.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── designs/        # Design CRUD + versioning + export
│   │   ├── comments/       # Comment CRUD + replies
│   │   ├── projects/       # Project CRUD
│   │   ├── folders/        # Folder CRUD
│   │   ├── share/          # Share link management
│   │   ├── export/         # Project-level export
│   │   ├── uploads/        # Static file serving
│   │   └── auth/           # Registration + NextAuth
│   ├── project/[projectId]/
│   │   └── design/[designId]/  # Design viewer with comments
│   ├── share/[token]/      # Public shared view
│   └── dashboard/          # Project listing
├── components/
│   ├── design/             # ImageViewer, MarkdownViewer, VersionHistory
│   ├── comments/           # PinLayer, CommentSidebar, CommentThread
│   ├── layout/             # Header, Sidebar, ThemeProvider
│   ├── share/              # ShareDialog, PasswordGate
│   └── export/             # ExportDialog
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   ├── db.ts               # Prisma client
│   ├── basePath.ts         # Base path helper for API/navigation URLs
│   ├── clipboard.ts        # Clipboard with fallback for non-HTTPS
│   ├── anchor.ts           # Comment anchor computation
│   └── export/             # Confluence, HTML, Markdown, Word exporters
└── prisma/
    └── schema.prisma       # Database schema
```

## How Comments Work

DesignForge uses a hybrid anchoring system for comments:

1. **Text anchoring** (markdown) — When you click to add a comment, the system captures the word at the click point using `document.caretRangeFromPoint`. This text anchor survives zoom, resolution, and layout changes.

2. **Coordinate fallback** — The click position is also stored as `(xPercent, yPercent)` for backward compatibility and for image designs.

3. **Auto-discard** — When a design's content is updated, comments whose anchored text no longer exists are automatically marked as "Discarded" (shown grayed out). If the text reappears (e.g., undo), comments are un-discarded.

4. **Version-aware** — Comments are locked to the version they were created on. Viewing an old version shows only comments from that version or earlier. Discard status is computed per-version.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
npm run dev          # Start dev server
npx tsc --noEmit     # Type check
npm run build        # Production build
npx prisma studio    # Browse database
```

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/), [Prisma](https://www.prisma.io/), and [Tailwind CSS](https://tailwindcss.com/)
- Markdown rendering by [react-markdown](https://github.com/remarkjs/react-markdown)
- Diagram support by [Mermaid](https://mermaid.js.org/)
