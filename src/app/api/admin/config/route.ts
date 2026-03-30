import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { encrypt } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await getBackupConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    id: config.id,
    apiUrl: config.apiUrl,
    repo: config.repo,
    branch: config.branch,
    cron: config.cron,
    enabled: config.enabled,
    tokenPreview: config.token.slice(0, 4) + "••••••••",
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { apiUrl, repo, branch, cronSchedule, enabled, token } = body;

  if (!repo) {
    return NextResponse.json({ error: "Repository is required" }, { status: 400 });
  }

  const existing = await prisma.backupConfig.findFirst();

  const base = {
    apiUrl: (apiUrl || "https://api.github.com").replace(/\/+$/, ""),
    repo,
    branch: branch || "main",
    cronSchedule: cronSchedule || "0 2 * * *",
    enabled: enabled !== false,
  };

  if (existing) {
    await prisma.backupConfig.update({
      where: { id: existing.id },
      data: token ? { ...base, encryptedToken: encrypt(token) } : base,
    });
  } else {
    if (!token) {
      return NextResponse.json({ error: "Token is required for initial setup" }, { status: 400 });
    }
    await prisma.backupConfig.create({
      data: { ...base, encryptedToken: encrypt(token) },
    });
  }

  const { startScheduler } = await import("@/lib/backup/scheduler");
  await startScheduler();

  return NextResponse.json({ success: true });
}
