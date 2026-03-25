import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { designIds, folderId } = body;

  if (!Array.isArray(designIds) || designIds.length === 0) {
    return NextResponse.json({ error: "designIds array is required" }, { status: 400 });
  }
  if (!folderId) {
    return NextResponse.json({ error: "folderId is required" }, { status: 400 });
  }

  const targetFolder = await prisma.folder.findUnique({ where: { id: folderId } });
  if (!targetFolder) {
    return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
  }

  const designs = await prisma.design.findMany({
    where: { id: { in: designIds } },
    include: { folder: true },
  });

  if (designs.length !== designIds.length) {
    return NextResponse.json({ error: "One or more designs not found" }, { status: 404 });
  }

  const session = await (await import("@/lib/auth")).auth();
  if (session?.user) {
    const { isOwnerOfDesign } = await import("@/lib/ownership");
    const username = (session.user as any).username;
    for (const design of designs) {
      const owns = await isOwnerOfDesign(design.id, username);
      if (!owns) {
        return NextResponse.json(
          { error: "Cannot move another user's designs" },
          { status: 403 }
        );
      }
    }
  }

  const wrongProject = designs.find((d) => d.folder.projectId !== targetFolder.projectId);
  if (wrongProject) {
    return NextResponse.json(
      { error: "All designs must belong to the same project as the target folder" },
      { status: 400 }
    );
  }

  const maxOrder = await prisma.design.aggregate({
    where: { folderId },
    _max: { order: true },
  });

  let nextOrder = (maxOrder._max.order ?? -1) + 1;
  for (const design of designs) {
    if (design.folderId !== folderId) {
      await prisma.design.update({
        where: { id: design.id },
        data: { folderId, order: nextOrder++ },
      });
    }
  }

  return NextResponse.json({ moved: designs.filter((d) => d.folderId !== folderId).length });
}
