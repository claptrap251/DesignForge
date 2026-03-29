import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const targetId = request.nextUrl.searchParams.get("targetId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10);

  const where = targetId ? { targetId } : {};
  const runs = await prisma.scrapeRun.findMany({
    where,
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(runs);
}
