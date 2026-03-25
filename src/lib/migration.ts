import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "app-config.json");

interface AppConfig {
  sharedProjectsMigrated?: boolean;
  [key: string]: any;
}

async function getConfig(): Promise<AppConfig> {
  try {
    const data = await readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveConfig(config: AppConfig): Promise<void> {
  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export async function runSharedProjectsMigration(): Promise<void> {
  const config = await getConfig();
  if (config.sharedProjectsMigrated) return;

  const { prisma } = await import("@/lib/db");

  console.log("[Migration] Starting shared projects migration...");

  const projects = await prisma.project.findMany({
    include: {
      owner: true,
      folders: {
        where: { parentId: null },
      },
    },
  });

  for (const project of projects) {
    // Skip projects that already have user-root folders
    const hasUserFolders = await prisma.folder.findFirst({
      where: { projectId: project.id, ownerUsername: { not: null } },
    });
    if (hasUserFolders) continue;

    const rootFolders = project.folders;
    if (rootFolders.length === 0) continue;

    const ownerUsername = project.owner?.username || "_legacy";

    // Create the user-root folder
    const maxOrder = await prisma.folder.aggregate({
      where: { projectId: project.id, parentId: null },
      _max: { order: true },
    });

    const userFolder = await prisma.folder.create({
      data: {
        name: ownerUsername,
        projectId: project.id,
        ownerUsername,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Move all existing root folders to be children of the user folder
    for (const folder of rootFolders) {
      await prisma.folder.update({
        where: { id: folder.id },
        data: { parentId: userFolder.id },
      });
    }

    console.log(
      `[Migration] Project "${project.name}": wrapped ${rootFolders.length} folders under "${ownerUsername}"`,
    );
  }

  config.sharedProjectsMigrated = true;
  await saveConfig(config);
  console.log("[Migration] Shared projects migration complete.");
}
