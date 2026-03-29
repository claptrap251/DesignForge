import cron, { type ScheduledTask } from "node-cron";
import { getBackupConfig } from "@/lib/admin";
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

interface BackupHistoryEntry {
  timestamp: string;
  type: "auto" | "manual";
  status: "success" | "partial" | "failed";
  fileCount: number;
  stats?: { users: number; projects: number; designs: number; comments: number };
  error?: string;
}

const HISTORY_PATH = path.join(process.cwd(), "data", "backup-history.json");

export async function getBackupHistory(): Promise<BackupHistoryEntry[]> {
  try {
    const data = await readFile(HISTORY_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export async function addBackupHistoryEntry(entry: BackupHistoryEntry): Promise<void> {
  const history = await getBackupHistory();
  history.unshift(entry);
  if (history.length > 50) history.length = 50;
  await mkdir(path.dirname(HISTORY_PATH), { recursive: true });
  await writeFile(HISTORY_PATH, JSON.stringify(history, null, 2));
}

export async function runBackup(type: "auto" | "manual"): Promise<BackupHistoryEntry> {
  const config = await getBackupConfig();
  if (!config) throw new Error("Backup not configured");

  const { serializeBackup } = await import("@/lib/backup/serialize");
  const { GitHubClient } = await import("@/lib/backup/github");

  const entry: BackupHistoryEntry = {
    timestamp: new Date().toISOString(),
    type,
    status: "failed",
    fileCount: 0,
  };

  try {
    const { files, stats } = await serializeBackup();
    const client = new GitHubClient(config);

    const treeItems = [];
    for (const file of files) {
      if ("binary" in file && file.binary) {
        const blobSha = await client.createBlob(
          (file.content as Buffer).toString("base64"),
          "base64"
        );
        treeItems.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blobSha,
        });
      } else {
        treeItems.push({
          path: file.path,
          mode: "100644" as const,
          type: "blob" as const,
          content: file.content as string,
        });
      }
    }

    const now = new Date();
    const message = `Backup ${now.toISOString().slice(0, 16).replace("T", " ")} (${type})`;
    await client.push(treeItems, message);

    entry.status = "success";
    entry.fileCount = files.length;
    entry.stats = stats;
  } catch (err: any) {
    entry.status = "failed";
    entry.error = err.message || "Unknown error";
  }

  await addBackupHistoryEntry(entry);
  return entry;
}

let scheduledTask: ScheduledTask | null = null;

export async function startScheduler(): Promise<void> {
  const config = await getBackupConfig();
  if (!config || !config.enabled) return;

  if (scheduledTask) {
    scheduledTask.stop();
  }

  if (!cron.validate(config.cron)) {
    console.error(`[Backup] Invalid cron expression: ${config.cron}`);
    return;
  }

  scheduledTask = cron.schedule(config.cron, async () => {
    console.log("[Backup] Starting scheduled backup...");
    const result = await runBackup("auto");
    console.log(`[Backup] Completed: ${result.status} (${result.fileCount} files)`);
  });

  console.log(`[Backup] Scheduler started with cron: ${config.cron}`);
}
