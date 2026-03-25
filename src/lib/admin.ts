/**
 * Check if the current session user is the admin.
 * Admin is determined by ADMIN_USERNAME env var — no DB schema changes.
 */
export function isAdmin(session: any): boolean {
  const adminUsername = process.env.ADMIN_USERNAME;
  if (!adminUsername) return false;
  return session?.user?.username === adminUsername;
}

/**
 * Get backup configuration from env vars.
 * Returns null if required vars are missing.
 */
export function getBackupConfig() {
  const repo = process.env.GITHUB_BACKUP_REPO;
  const token = process.env.GITHUB_BACKUP_TOKEN;
  if (!repo || !token) return null;

  return {
    apiUrl: (process.env.GITHUB_BACKUP_URL || "https://api.github.com").replace(/\/+$/, ""),
    repo,
    token,
    branch: process.env.GITHUB_BACKUP_BRANCH || "main",
    cron: process.env.BACKUP_SCHEDULE_CRON || "0 2 * * *",
  };
}
