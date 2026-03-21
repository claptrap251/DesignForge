import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { designId: id },
    orderBy: { pinNumber: "asc" },
    include: {
      replies: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  return NextResponse.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { xPercent, yPercent, content, authorName } = body;

  if (xPercent === undefined || yPercent === undefined || !content || !authorName) {
    return NextResponse.json(
      { error: "xPercent, yPercent, content, and authorName are required" },
      { status: 400 }
    );
  }

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const maxPin = await prisma.comment.aggregate({
    where: { designId: id },
    _max: { pinNumber: true },
  });

  const pinNumber = (maxPin._max.pinNumber ?? 0) + 1;

  const comment = await prisma.comment.create({
    data: {
      designId: id,
      xPercent,
      yPercent,
      pinNumber,
      content,
      authorName,
    },
    include: {
      replies: true,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
