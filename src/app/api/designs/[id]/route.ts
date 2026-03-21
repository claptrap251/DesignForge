import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { unlink } from "fs/promises";
import path from "path";

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
  const body = await request.json();
  const { name, content } = body;

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const updated = await prisma.design.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && design.type === "MARKDOWN" && { content }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  if (design.type === "IMAGE" && design.filePath) {
    const fullPath = path.join(/* turbopackIgnore: true */ process.cwd(), "uploads", design.filePath);
    try {
      await unlink(fullPath);
    } catch {
      // File may already be deleted, continue
    }
  }

  await prisma.design.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
