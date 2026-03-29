import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";

/**
 * Check if the current session user is the admin.
 * Admin is determined by ADMIN_USERNAME env var.
 */
export function isAdmin(session: any): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return false;
  return session?.user?.username === adminUsername;
}

/**
 * Get backup configuration from the database.
 * Returns null if not configured.
 */
export async function getBackupConfig() {
  const config = await prisma.backupConfig.findFirst();
  if (!config) return null;

  return {
    id: config.id,
    apiUrl: config.apiUrl.replace(/\/+$/, ""),
    repo: config.repo,
    token: decrypt(config.encryptedToken),
    branch: config.branch,
    cron: config.cronSchedule,
    enabled: config.enabled,
  };
}

/**
 * Migrate backup config from env vars to DB (one-time, on startup).
 * Only runs if DB has no BackupConfig rows AND env vars are present.
 */
export async function migrateBackupConfigFromEnv(): Promise<boolean> {
  const existing = await prisma.backupConfig.findFirst();
  if (existing) return false;

  const repo = process.env.GITHUB_BACKUP_REPO;
  const token = process.env.GITHUB_BACKUP_TOKEN;
  if (!repo || !token) return false;

  const { encrypt } = await import("@/lib/crypto");

  await prisma.backupConfig.create({
    data: {
      apiUrl: (process.env.GITHUB_BACKUP_URL || "https://api.github.com").replace(/\/+$/, ""),
      repo,
      encryptedToken: encrypt(token),
      branch: process.env.GITHUB_BACKUP_BRANCH || "main",
      cronSchedule: process.env.BACKUP_SCHEDULE_CRON || "0 2 * * *",
      enabled: true,
    },
  });

  console.log("[Migration] Backup config migrated from env vars to database");
  return true;
}
