import { Command } from "commander";
import { DFClient } from "../client";
import { Format, output, error } from "../utils";
import fs from "fs";
import path from "path";

export function uploadCommand(getClient: () => DFClient): Command {
  return new Command("upload")
    .description("Upload markdown files to a DesignForge project")
    .argument("<files...>", "File paths or glob patterns")
    .requiredOption("--project <name|id>", "Project scope")
    .option("--dest <path>", "Destination folder path in project", "")
    .option("--overwrite", "Overwrite / create new version if exists", false)
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (fileArgs: string[], opts: { project: string; dest: string; overwrite: boolean; format: Format }) => {
      const client = getClient();

      if (!client.isAuthenticated) {
        error("Authentication required for upload. Set DFCLI_TOKEN or use --token.", 2);
      }

      // Resolve project to get ID
      const { status: projStatus, data: projData } = await client.request("GET", "/api/cli/projects");
      if (projStatus !== 200) error("Failed to fetch projects", 1);

      const projects = projData as { id: string; name: string }[];
      const project = projects.find(
        (p) => p.id === opts.project || p.name.toLowerCase() === opts.project.toLowerCase()
      );
      if (!project) error(`Project not found: ${opts.project}`, 3);

      // Resolve files (expand simple globs)
      const filePaths: string[] = [];
      for (const arg of fileArgs) {
        if (arg.includes("*")) {
          const dir = path.dirname(arg);
          const pattern = path.basename(arg);
          const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
          try {
            const entries = fs.readdirSync(dir || ".");
            for (const entry of entries) {
              if (regex.test(entry) && /\.(md|markdown)$/i.test(entry)) {
                filePaths.push(path.join(dir || ".", entry));
              }
            }
          } catch {
            error(`Cannot read directory: ${dir}`, 1);
          }
        } else {
          filePaths.push(arg);
        }
      }

      if (filePaths.length === 0) {
        error("No markdown files found matching the given patterns", 1);
      }

      const results: { localPath: string; remotePath: string; status: string }[] = [];

      for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) {
          error(`File not found: ${filePath}`, 3);
        }

        const content = fs.readFileSync(filePath, "utf-8");
        const name = path.basename(filePath);

        const { status, data } = await client.request("POST", "/api/cli/files", {
          projectId: project!.id,
          destPath: opts.dest,
          name,
          content,
          overwrite: opts.overwrite,
        });

        if (status === 409) {
          error(`File already exists: ${name}. Use --overwrite to create a new version.`, 1);
        }
        if (status !== 200 && status !== 201) {
          error(`Failed to upload ${name}: ${JSON.stringify(data)}`, 1);
        }

        const result = data as { path: string; status: string };
        results.push({ localPath: filePath, remotePath: result.path, status: result.status });
      }

      if (opts.format === "json") {
        output({ uploaded: results }, "json");
      } else {
        for (const r of results) {
          process.stdout.write(`${r.status}  ${r.localPath} → ${r.remotePath}\n`);
        }
      }
    });
}
