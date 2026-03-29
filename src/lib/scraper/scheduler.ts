import cron, { type ScheduledTask } from "node-cron";
import { prisma } from "@/lib/db";

const activeTasks = new Map<string, ScheduledTask>();

export function registerTarget(target: { id: string; cronSchedule: string; name: string }): void {
  unregisterTarget(target.id);

  if (!cron.validate(target.cronSchedule)) {
    console.error(`[Scraper] Invalid cron for "${target.name}": ${target.cronSchedule}`);
    return;
  }

  const task = cron.schedule(target.cronSchedule, async () => {
    console.log(`[Scraper] Starting scheduled scrape for "${target.name}"...`);
    const { runScrape } = await import("./engine");
    const result = await runScrape(target.id, "auto");
    console.log(`[Scraper] "${target.name}" completed: ${result.status} (${result.filesCreated} new, ${result.filesUpdated} updated)`);
  });

  activeTasks.set(target.id, task);
  console.log(`[Scraper] Registered "${target.name}" with cron: ${target.cronSchedule}`);
}

export function unregisterTarget(targetId: string): void {
  const existing = activeTasks.get(targetId);
  if (existing) {
    existing.stop();
    activeTasks.delete(targetId);
  }
}

export async function startScrapeScheduler(): Promise<void> {
  const targets = await prisma.scrapeTarget.findMany({ where: { enabled: true } });
  for (const target of targets) {
    registerTarget(target);
  }
  if (targets.length > 0) {
    console.log(`[Scraper] Scheduler started with ${targets.length} target(s)`);
  }
}

export async function runScrapeNow(targetId: string): Promise<unknown> {
  const { runScrape } = await import("./engine");
  return runScrape(targetId, "manual");
}
