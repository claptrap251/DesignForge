import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { authenticateRequest } from "@/lib/apiAuth";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  let name: string | null = null;
  let type: string | null = null;
  let folderId: string | null = null;
  let file: File | null = null;
  let content: string | null = null;

  if (contentType.includes("application/json")) {
    const body = await request.json();
    name = body.name;
    type = (body.type as string)?.toUpperCase() || null;
    folderId = body.folderId;
    content = body.content;
  } else {
    const formData = await request.formData();
    name = formData.get("name") as string;
    type = (formData.get("type") as string)?.toUpperCase() || null;
    folderId = formData.get("folderId") as string;
    file = formData.get("file") as File | null;
    content = formData.get("content") as string | null;
  }

  if (!name || !type || !folderId) {
    return NextResponse.json(
      { error: "name, type, and folderId are required" },
      { status: 400 }
    );
  }

  if (!["IMAGE", "MARKDOWN"].includes(type)) {
    return NextResponse.json(
      { error: "type must be IMAGE or MARKDOWN" },
      { status: 400 }
    );
  }

  const folder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  // Block uploads directly in user-root folders (must use a sub-folder)
  if (folder.ownerUsername && !folder.parentId) {
    return NextResponse.json(
      { error: "Cannot upload designs directly in your user folder. Create a sub-folder first." },
      { status: 400 }
    );
  }

  const { user } = await authenticateRequest(request);
  if (user) {
    const { isOwnerOfFolder } = await import("@/lib/ownership");
    const owns = await isOwnerOfFolder(folderId!, user.username);
    if (!owns) {
      return NextResponse.json(
        { error: "Cannot upload to another user's folder" },
        { status: 403 }
      );
    }
  }

  let filePath: string | null = null;
  let markdownContent: string | null = null;

  if (type === "IMAGE") {
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

    filePath = filename;
  } else {
    if (!content) {
      return NextResponse.json(
        { error: "Content is required for MARKDOWN type" },
        { status: 400 }
      );
    }
    markdownContent = content;
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  const design = await prisma.design.create({
    data: {
      name,
      type,
      filePath,
      content: markdownContent,
      folderId,
      currentVersion: 1,
      order: (maxOrder._max.order ?? -1) + 1,
      versions: {
        create: {
          version: 1,
          filePath,
          content: markdownContent,
        },
      },
    },
    include: { versions: true },
  });

  return NextResponse.json(design, { status: 201 });
}
