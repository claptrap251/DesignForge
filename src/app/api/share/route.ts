import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hash } from "bcryptjs";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { projectId, folderId, password, expiresAt } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const token = crypto.randomUUID();
  let passwordHash: string | null = null;

  if (password) {
    passwordHash = await hash(password, 12);
  }

  const shareLink = await prisma.shareLink.create({
    data: {
      projectId,
      folderId: folderId || null,
      token,
      passwordHash,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json(
    {
      id: shareLink.id,
      token: shareLink.token,
      expiresAt: shareLink.expiresAt,
      hasPassword: !!passwordHash,
    },
    { status: 201 }
  );
}
