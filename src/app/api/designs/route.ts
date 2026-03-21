import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const name = formData.get("name") as string;
  const type = formData.get("type") as string;
  const folderId = formData.get("folderId") as string;
  const file = formData.get("file") as File | null;
  const content = formData.get("content") as string | null;

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
