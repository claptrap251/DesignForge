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
    xPercent, yPercent, content, authorName, authorId,
    anchorLine, anchorHeading, anchorContext, contextBefore, contextAfter,
  } = body;

  if (!content || !authorName) {
    return NextResponse.json(
      { error: "content and authorName are required" },
      { status: 400 }
    );
  }

  // Validate: either (xPercent + yPercent) or anchorLine, not both, not neither
  const hasPosition = xPercent !== undefined && yPercent !== undefined;
  const hasAnchor = anchorLine !== undefined;

  if (!hasPosition && !hasAnchor) {
    return NextResponse.json(
      { error: "Either (xPercent + yPercent) or anchorLine is required" },
      { status: 400 }
    );
  }
  if (hasPosition && hasAnchor) {
    return NextResponse.json(
      { error: "Cannot provide both (xPercent + yPercent) and anchorLine" },
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
      anchorLine: hasAnchor ? anchorLine : null,
      anchorHeading: hasAnchor ? (anchorHeading ?? null) : null,
      anchorContext: hasAnchor ? (anchorContext ?? null) : null,
      contextBefore: hasAnchor ? (contextBefore ?? null) : null,
      contextAfter: hasAnchor ? (contextAfter ?? null) : null,
      pinNumber,
      content,
      authorName,
      ...(authorId ? { authorId } : {}),
    },
    include: { replies: true },
  });

  return NextResponse.json(comment, { status: 201 });
}
