import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdmin, getBackupConfig } from "@/lib/admin";
import { getBackupHistory, runBackup } from "@/lib/backup/scheduler";

export async function GET() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const history = await getBackupHistory();
  return NextResponse.json({ history });
}

export async function POST() {
  const session = await auth();
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = getBackupConfig();
  if (!config) {
    return NextResponse.json({ error: "Backup not configured" }, { status: 400 });
  }

  const result = await runBackup("manual");
  return NextResponse.json(result);
}
