import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, githubType, githubName, apiUrl, token, cronSchedule, enabled, projectId } = body;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;
  if (githubType !== undefined) data.githubType = githubType;
  if (githubName !== undefined) data.githubName = githubName;
  if (apiUrl !== undefined) data.apiUrl = apiUrl.replace(/\/+$/, "");
  if (token) data.encryptedToken = encrypt(token);
  if (cronSchedule !== undefined) data.cronSchedule = cronSchedule;
  if (enabled !== undefined) data.enabled = enabled;
  if (projectId !== undefined) data.projectId = projectId;

  const updated = await prisma.scrapeTarget.update({ where: { id }, data });

  const { registerTarget, unregisterTarget } = await import("@/lib/scraper/scheduler");
  if (updated.enabled) {
    registerTarget(updated);
  } else {
    unregisterTarget(updated.id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const { unregisterTarget } = await import("@/lib/scraper/scheduler");
  unregisterTarget(id);

  await prisma.scrapeTarget.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
