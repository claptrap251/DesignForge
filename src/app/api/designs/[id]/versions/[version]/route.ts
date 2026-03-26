import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/apiAuth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  const { user } = await authenticateRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, version: versionStr } = await params;
  const versionNum = parseInt(versionStr, 10);

  if (isNaN(versionNum) || versionNum < 1) {
    return NextResponse.json({ error: "Invalid version number" }, { status: 400 });
  }

  const designVersion = await prisma.designVersion.findFirst({
    where: { designId: id, version: versionNum },
  });

  if (!designVersion) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  return NextResponse.json(designVersion);
}
