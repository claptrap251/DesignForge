import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/apiAuth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const design = await prisma.design.findUnique({ where: { id } });
  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  // Check ownership
  const { isOwnerOfDesign } = await import("@/lib/ownership");
  const owns = await isOwnerOfDesign(id, user.username);
  if (!owns) {
    return NextResponse.json({ error: "Cannot edit another user's design" }, { status: 403 });
  }

  const body = await request.json();
  const { version } = body;

  if (!version || typeof version !== "number") {
    return NextResponse.json({ error: "version is required (number)" }, { status: 400 });
  }

  const targetVersion = await prisma.designVersion.findFirst({
    where: { designId: id, version },
  });

  if (!targetVersion) {
    return NextResponse.json({ error: `Version ${version} not found` }, { status: 404 });
  }

  const newVersionNum = design.currentVersion + 1;
  const changeNote = `Reverted to version ${version}`;

  const updated = await prisma.design.update({
    where: { id },
    data: {
      content: targetVersion.content,
      filePath: targetVersion.filePath,
      currentVersion: newVersionNum,
      versions: {
        create: {
          version: newVersionNum,
          content: targetVersion.content,
          filePath: targetVersion.filePath,
          changeNote,
        },
      },
    },
    include: {
      versions: { orderBy: { version: "desc" } },
    },
  });

  return NextResponse.json(updated);
}
