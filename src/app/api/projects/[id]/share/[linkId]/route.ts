import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const link = await prisma.shareLink.findUnique({
    where: { id: linkId },
  });

  if (!link || link.projectId !== id) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }

  await prisma.shareLink.delete({ where: { id: linkId } });

  return NextResponse.json({ success: true });
}
