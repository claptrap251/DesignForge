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
  const {
    xPercent, yPercent, content, authorName, authorId, anchorText,
    anchorLine, anchorHeading, anchorContext, contextBefore, contextAfter,
  } = body;

  if (!content || !authorName) {
    return NextResponse.json(
      { error: "content and authorName are required" },
      { status: 400 }
    );
  }

  // Validate: need position, anchorLine, or anchorText
  const hasPosition = xPercent !== undefined && yPercent !== undefined;
  const hasAnchor = anchorLine !== undefined;
  const hasTextAnchor = anchorText !== undefined && anchorText !== null;

  if (!hasPosition && !hasAnchor && !hasTextAnchor) {
    return NextResponse.json(
      { error: "Either (xPercent + yPercent), anchorLine, or anchorText is required" },
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
      xPercent: hasPosition ? xPercent : null,
      yPercent: hasPosition ? yPercent : null,
      anchorText: hasTextAnchor ? anchorText : null,
      anchorLine: hasAnchor ? anchorLine : null,
      anchorHeading: hasAnchor ? (anchorHeading ?? null) : null,
      anchorContext: hasAnchor ? (anchorContext ?? null) : null,
      contextBefore: hasAnchor ? (contextBefore ?? null) : null,
      contextAfter: hasAnchor ? (contextAfter ?? null) : null,
      pinNumber,
      content,
      authorName,
      version: design.currentVersion,
      ...(authorId ? { authorId } : {}),
    },
    include: { replies: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
