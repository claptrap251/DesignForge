# DesignForge

A self-hosted design review platform. Upload designs, pin comments directly on them, collaborate with your team — all running entirely on your own infrastructure with zero external dependencies.

## Features

- **Design uploads** — Drag-and-drop images (PNG, JPG, GIF, SVG, WebP) or write Markdown documents
- **Pinned comments** — Click anywhere on a design to leave feedback at that exact location
- **Threaded replies** — Reply to comments and mark them as resolved
- **Version history** — Upload new versions of a design while preserving all comments; browse and compare previous versions with change notes
- **Project organization** — Group designs into projects with nested folders
- **Shareable links** — Generate share links with optional password protection and expiry dates
- **Export** — Export projects as PDF or Word documents
- **Fully local** — No external API calls, no CDNs, no analytics, no telemetry. Uses local SQLite, local file storage, and system fonts

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: SQLite via Prisma ORM
- **Auth**: NextAuth.js with credentials provider (bcryptjs)
- **Styling**: Tailwind CSS with system fonts
- **File storage**: Local `uploads/` directory
- **Export**: @react-pdf/renderer (PDF), docx (Word)

## Getting Started

### Prerequisites

- Node.js 18+

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Initialize the database
npx prisma db push

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to get started.

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | SQLite database path | `file:./dev.db` |
| `NEXTAUTH_SECRET` | Session encryption key | — |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` |
| `UPLOAD_DIR` | Directory for uploaded files | `./uploads` |
| `NEXT_PUBLIC_BASE_PATH` | Serve app under a sub-path (e.g. `/design`) | — |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── designs/        # Design CRUD + versioning
│   │   ├── comments/       # Comment CRUD + replies
│   │   ├── projects/       # Project CRUD
│   │   ├── folders/        # Folder CRUD
│   │   ├── share/          # Share link management
│   │   ├── export/         # PDF/Word export
│   │   ├── uploads/        # Static file serving
│   │   └── auth/           # Registration + NextAuth
│   ├── project/[projectId]/
│   │   └── design/[designId]/  # Design viewer with comments
│   ├── share/[token]/      # Public shared view
│   └── dashboard/          # Project listing
├── components/
│   ├── design/             # ImageViewer, MarkdownViewer, VersionHistory, UploadNewVersion
│   ├── comments/           # PinLayer, CommentSidebar
│   ├── layout/             # Header
│   ├── share/              # ShareDialog, PasswordGate
│   └── export/             # ExportDialog
├── lib/
│   ├── auth.ts             # NextAuth configuration
│   └── db.ts               # Prisma client
└── prisma/
    └── schema.prisma       # Database schema
```

## Design Versioning

When a design is updated (full rewrite or image replacement):

1. The previous version is saved as a `DesignVersion` snapshot
2. All comments remain attached to the design — they persist across versions
3. You can browse any previous version from the version history dropdown
4. Each version can include an optional change note

Comments use percentage-based coordinates, so pin positions stay consistent across versions with similar layouts.

## Production Build

```bash
npm run build
npm start
```

The app builds as a standalone Next.js application suitable for self-hosting.
