import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isOwnerOfFolder } from "@/lib/ownership";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const username = (session.user as any).username;
  const admin = isAdmin(session);

  const body = await request.json();
  const { name, projectId, parentId, ownerUsername } = body;

  if (!name || !projectId) {
    return NextResponse.json(
      { error: "Name and projectId are required" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  if (parentId) {
    const parentFolder = await prisma.folder.findUnique({
      where: { id: parentId },
    });
    if (!parentFolder || parentFolder.projectId !== projectId) {
      return NextResponse.json(
        { error: "Parent folder not found in this project" },
        { status: 400 }
      );
    }

    // Non-admin users can only create inside their own folder tree
    if (!admin) {
      const ownsParent = await isOwnerOfFolder(parentId, username);
      if (!ownsParent) {
        return NextResponse.json(
          { error: "Cannot create folders in another user's space" },
          { status: 403 }
        );
      }
    }
  } else {
    // Root-level folder: non-admin can only create their own user-root folder
    if (!admin && (!ownerUsername || ownerUsername !== username)) {
      return NextResponse.json(
        { error: "Cannot create root-level folders outside your own namespace" },
        { status: 403 }
      );
    }
  }

  // Prevent duplicate user-root folders
  if (ownerUsername && !parentId) {
    const existing = await prisma.folder.findFirst({
      where: { projectId, ownerUsername, parentId: null },
    });
    if (existing) {
      return NextResponse.json(existing);
    }
  }

  const maxOrder = await prisma.folder.aggregate({
    where: { projectId, parentId: parentId || null },
    _max: { order: true },
  });

  const folder = await prisma.folder.create({
    data: {
      name,
      projectId,
      parentId: parentId || null,
      order: (maxOrder._max.order ?? -1) + 1,
      ownerUsername: ownerUsername || null,
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
