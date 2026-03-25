import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getBackupConfig();
  if (!config) {
    return NextResponse.json({ configured: false });
  }

  return NextResponse.json({
    configured: true,
    apiUrl: config.apiUrl,
    repo: config.repo,
    branch: config.branch,
    cron: config.cron,
    tokenPreview: config.token.slice(0, 4) + "••••••••",
  });
}
