import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";
import crypto from "crypto";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const links = await prisma.shareLink.findMany({
    where: { projectId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      token: true,
      passwordHash: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    links.map((link) => ({
      id: link.id,
      token: link.token,
      password: !!link.passwordHash,
      expiresAt: link.expiresAt,
      createdAt: link.createdAt,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await request.json();
  const { password, expiryDays } = body;

  const token = crypto.randomUUID();
  let passwordHash: string | null = null;
  if (password) {
    passwordHash = await hash(password, 12);
  }

  let expiresAt: Date | null = null;
  if (expiryDays && parseInt(expiryDays) > 0) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiryDays));
  }

  const shareLink = await prisma.shareLink.create({
    data: {
      projectId: id,
      token,
      passwordHash,
      expiresAt,
    },
  });

  return NextResponse.json(
    {
      id: shareLink.id,
      token: shareLink.token,
      password: !!passwordHash,
      expiresAt: shareLink.expiresAt,
      createdAt: shareLink.createdAt,
    },
    { status: 201 }
  );
}
