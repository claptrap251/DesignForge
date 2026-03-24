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

  return NextResponse.json(updated);
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
