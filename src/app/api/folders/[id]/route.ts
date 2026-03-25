import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isOwnerOfFolder } from "@/lib/ownership";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const folder = await prisma.folder.findUnique({
    where: { id },
    include: {
      designs: {
        orderBy: { order: "asc" },
      },
    },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  return NextResponse.json(folder);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username = (session.user as any).username;
  const owns = await isOwnerOfFolder(id, username);
  if (!owns) {
    return NextResponse.json({ error: "Cannot modify another user's folder" }, { status: 403 });
  }

  const body = await request.json();
  const { name } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username = (session.user as any).username;
  const admin = isAdmin(session);
  const owns = await isOwnerOfFolder(id, username);
  if (!owns && !admin) {
    return NextResponse.json({ error: "Cannot delete another user's folder" }, { status: 403 });
  }

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  await prisma.folder.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
