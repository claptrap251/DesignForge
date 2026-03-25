export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/backup/scheduler");
    startScheduler();

    const { runSharedProjectsMigration } = await import("@/lib/migration");
    await runSharedProjectsMigration();
  }
}
