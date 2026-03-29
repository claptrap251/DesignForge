export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateBackupConfigFromEnv } = await import("@/lib/admin");
    await migrateBackupConfigFromEnv();

    const { startScheduler } = await import("@/lib/backup/scheduler");
    await startScheduler();

    const { startScrapeScheduler } = await import("@/lib/scraper/scheduler");
    await startScrapeScheduler();

    const { runSharedProjectsMigration } = await import("@/lib/migration");
    await runSharedProjectsMigration();
  }
}
