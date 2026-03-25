import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unlink, writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const design = await prisma.design.findUnique({
    where: { id },
    include: {
      comments: {
        orderBy: { pinNumber: "asc" },
        include: {
          replies: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      versions: {
        orderBy: { version: "desc" },
      },
    },
  });

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  return NextResponse.json(design);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const contentType = request.headers.get("content-type") || "";

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const session = await (await import("@/lib/auth")).auth();
  if (session?.user) {
    const { isOwnerOfDesign } = await import("@/lib/ownership");
    const username = (session.user as any).username;
    const owns = await isOwnerOfDesign(id, username);
    if (!owns) {
      return NextResponse.json({ error: "Cannot edit another user's design" }, { status: 403 });
    }
  }

  // Handle multipart form data (new version upload)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;
    const changeNote = formData.get("changeNote") as string | null;

    const newVersion = design.currentVersion + 1;
    let newFilePath: string | null = null;
    let newContent: string | null = null;

    if (design.type === "IMAGE") {
      if (!file) {
        return NextResponse.json(
          { error: "File is required for IMAGE type" },
          { status: 400 }
        );
      }

      const ext = path.extname(file.name) || ".png";
      const filename = `${uuidv4()}${ext}`;
      const uploadsDir = path.join(/* turbopackIgnore: true */ process.cwd(), "uploads");
      await mkdir(uploadsDir, { recursive: true });
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(uploadsDir, filename), buffer);
      newFilePath = filename;
    } else {
      if (!content) {
        return NextResponse.json(
          { error: "Content is required for MARKDOWN type" },
          { status: 400 }
        );
      }
      newContent = content;
    }

    const updated = await prisma.design.update({
      where: { id },
      data: {
        filePath: newFilePath ?? design.filePath,
        content: newContent ?? design.content,
        currentVersion: newVersion,
        versions: {
          create: {
            version: newVersion,
            filePath: newFilePath,
            content: newContent,
            changeNote,
          },
        },
      },
      include: {
        versions: { orderBy: { version: "desc" } },
        comments: {
          orderBy: { pinNumber: "asc" },
          include: { replies: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    // Auto-discard comments whose anchored text was removed
    if (newContent) {
      await autoDiscardComments(id, newContent);
    }

    return NextResponse.json(updated);
  }

  // Handle JSON body (name/content/status update - minor edit, no new version)
  const body = await request.json();
  const { name, content, status } = body;

  const validStatuses = ["DRAFT", "IN_REVIEW", "APPROVED"];
  if (status !== undefined && !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.design.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && design.type === "MARKDOWN" && { content }),
      ...(status !== undefined && { status }),
    },
  });

  // Auto-discard comments whose anchored text was removed (JSON content update)
  if (content !== undefined && design.type === "MARKDOWN") {
    await autoDiscardComments(id, content as string);
  }

  return NextResponse.json(updated);
}

/**
 * Check all comments on a design and auto-discard those whose anchored
 * text no longer exists in the new content. For old yPercent-only comments,
 * backfill anchorText from the estimated position first.
 */
async function autoDiscardComments(designId: string, newContent: string) {
  const comments = await prisma.comment.findMany({
    where: { designId },
  });

  const lines = newContent.split("\n");
  const totalLines = lines.length;

  for (const comment of comments) {
    // Backfill anchorText for old yPercent-only comments
    if (!comment.anchorText && comment.yPercent != null && totalLines > 0) {
      const lineIdx = Math.max(0, Math.round((comment.yPercent / 100) * totalLines) - 1);
      let anchor: string | null = null;
      for (let i = Math.max(0, lineIdx - 1); i <= Math.min(totalLines - 1, lineIdx + 1); i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith("#") && !line.startsWith("```") && line.length >= 3) {
          anchor = line.length > 80 ? line.slice(0, 80) : line;
          break;
        }
      }
      if (anchor) {
        await prisma.comment.update({ where: { id: comment.id }, data: { anchorText: anchor } });
        comment.anchorText = anchor;
      } else if (!comment.discarded) {
        // No meaningful text found nearby — the content was likely deleted
        await prisma.comment.update({ where: { id: comment.id }, data: { discarded: true } });
        continue;
      }
    }

    if (!comment.anchorText) continue;

    const textExists = newContent.includes(comment.anchorText);
    if (!textExists && !comment.discarded) {
      await prisma.comment.update({ where: { id: comment.id }, data: { discarded: true } });
    } else if (textExists && comment.discarded) {
      await prisma.comment.update({ where: { id: comment.id }, data: { discarded: false } });
    }
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const design = await prisma.design.findUnique({
    where: { id },
    include: { versions: true },
  });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const session = await (await import("@/lib/auth")).auth();
  if (session?.user) {
    const { isOwnerOfDesign } = await import("@/lib/ownership");
    const username = (session.user as any).username;
    const owns = await isOwnerOfDesign(id, username);
    if (!owns) {
      return NextResponse.json({ error: "Cannot edit another user's design" }, { status: 403 });
    }
  }

  // Delete all version files and the current file
  const filesToDelete = [
    design.filePath,
    ...design.versions.map((v) => v.filePath),
  ].filter(Boolean) as string[];

  for (const fp of filesToDelete) {
    const fullPath = path.join(/* turbopackIgnore: true */ process.cwd(), "uploads", fp);
    try {
      await unlink(fullPath);
    } catch {
      // File may already be deleted
    }
  }

  await prisma.design.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
