import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { folderId } = body;

  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  const design = await prisma.design.findUnique({
    where: { id },
    include: { folder: true },
  });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const session = await (await import("@/lib/auth")).auth();
  if (session?.user) {
    const { isOwnerOfDesign } = await import("@/lib/ownership");
    const username = (session.user as any).username;
    const owns = await isOwnerOfDesign(id, username);
    if (!owns) {
      return NextResponse.json({ error: "Cannot move another user's design" }, { status: 403 });
    }
  }

  const targetFolder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!targetFolder) {
    return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
  }

  if (design.folder.projectId !== targetFolder.projectId) {
    return NextResponse.json(
      { error: "Cannot move design to a folder in a different project" },
      { status: 400 }
    );
  }

  if (design.folderId === folderId) {
    return NextResponse.json({ error: "Design is already in this folder" }, { status: 400 });
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  const updated = await prisma.design.update({
    where: { id },
    data: { folderId, order: (maxOrder._max.order ?? -1) + 1 },
  });

  return NextResponse.json(updated);
}
