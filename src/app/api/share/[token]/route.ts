import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { compare } from "bcryptjs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
  });

  if (!shareLink) {
    return NextResponse.json(
      { error: "Invalid share link" },
      { status: 404 }
    );
  }

  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Share link has expired" },
      { status: 410 }
    );
  }

  if (shareLink.passwordHash) {
    const password = request.nextUrl.searchParams.get("password");
    if (!password) {
      return NextResponse.json(
        { error: "Password required", passwordProtected: true },
        { status: 401 }
      );
    }

    const isValid = await compare(password, shareLink.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }
  }

  const project = await prisma.project.findUnique({
    where: { id: shareLink.projectId },
    include: {
      folders: {
        include: {
          children: {
            include: {
              designs: true,
            },
          },
          designs: true,
        },
        where: shareLink.folderId
          ? { id: shareLink.folderId }
          : { parentId: null },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ project });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { password } = body;

  if (!password) {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 }
    );
  }

  const shareLink = await prisma.shareLink.findUnique({
    where: { token },
  });

  if (!shareLink) {
    return NextResponse.json(
      { error: "Invalid share link" },
      { status: 404 }
    );
  }

  if (shareLink.expiresAt && shareLink.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Share link has expired" },
      { status: 410 }
    );
  }

  if (!shareLink.passwordHash) {
    return NextResponse.json({ valid: true });
  }

  const isValid = await compare(password, shareLink.passwordHash);
  if (!isValid) {
    return NextResponse.json(
      { error: "Invalid password" },
      { status: 401 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: shareLink.projectId },
    include: {
      folders: {
        include: {
          children: {
            include: {
              designs: true,
            },
          },
          designs: true,
        },
        where: shareLink.folderId
          ? { id: shareLink.folderId }
          : { parentId: null },
        orderBy: { order: "asc" },
      },
    },
  });

  return NextResponse.json({ project, valid: true });
}
