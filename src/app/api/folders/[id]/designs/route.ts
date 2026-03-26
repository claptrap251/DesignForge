import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/apiAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const typeFilter = searchParams.get("type");
  const statusFilter = searchParams.get("status");

  const folder = await prisma.folder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const where: any = { folderId: id };
  if (typeFilter) where.type = typeFilter;
  if (statusFilter) where.status = statusFilter;

  const designs = await prisma.design.findMany({
    where,
    orderBy: { order: "asc" },
    select: {
      id: true,
      name: true,
      type: true,
      status: true,
      currentVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ folderId: id, designs });
}
