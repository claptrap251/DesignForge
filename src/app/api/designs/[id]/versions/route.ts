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

  const design = await prisma.design.findUnique({
    where: { id },
    select: { id: true, name: true, currentVersion: true },
  });

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const versions = await prisma.designVersion.findMany({
    where: { designId: id },
    orderBy: { version: "desc" },
    select: {
      id: true,
      version: true,
      changeNote: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ designId: id, currentVersion: design.currentVersion, versions });
}
