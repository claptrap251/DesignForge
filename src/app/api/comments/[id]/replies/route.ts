import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { content, authorName, authorId } = body;

  if (!content || !authorName) {
    return NextResponse.json(
      { error: "content and authorName are required" },
      { status: 400 }
    );
  }

  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const reply = await prisma.reply.create({
    data: {
      commentId: id,
      content,
      authorName,
      ...(authorId ? { authorId } : {}),
    },
  });

  return NextResponse.json(reply, { status: 201 });
}
