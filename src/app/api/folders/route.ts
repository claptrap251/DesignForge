import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, projectId, parentId } = body;

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
    },
  });

  return NextResponse.json(folder, { status: 201 });
}
