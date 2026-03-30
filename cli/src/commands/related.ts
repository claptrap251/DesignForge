import { Command } from "commander";
import { DFClient } from "../client";
import { Format, output, error } from "../utils";
import fs from "fs";
import path from "path";

export function relatedCommand(getClient: () => DFClient): Command {
  return new Command("related")
    .description("Find related markdown files by similarity (primary workflow command)")
    .argument("<file>", "Local file path or remote path in DesignForge")
    .requiredOption("--project <name|id>", "Project scope")
    .option("--source <source>", "Filter: scraped, user, or all", "all")
    .option("--repo <name>", "Filter to a specific scraped repo")
    .option("--min-score <n>", "Minimum relevance threshold (0.0-1.0)", "0.3")
    .option("--limit <n>", "Max results", "10")
    .option("--include-content", "Include file contents in output", false)
    .option("--no-upload", "Skip auto-upload even if authenticated")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (file: string, opts: {
      project: string;
      source: string;
      repo?: string;
      minScore: string;
      limit: string;
      includeContent: boolean;
      upload: boolean;
      format: Format;
    }) => {
      const client = getClient();

      // Resolve project
      const { status: projStatus, data: projData } = await client.request("GET", "/api/cli/projects");
      if (projStatus !== 200) error("Failed to fetch projects", 1);

      const projects = projData as { id: string; name: string }[];
      const project = projects.find(
        (p) => p.id === opts.project || p.name.toLowerCase() === opts.project.toLowerCase()
      );
      if (!project) error(`Project not found: ${opts.project}`, 3);

      // Determine content: local file or remote path
      let content: string;
      let fileName: string;

      if (fs.existsSync(file)) {
        content = fs.readFileSync(file, "utf-8");
        fileName = path.basename(file);
      } else {
        // Treat as remote path — fetch from DesignForge
        const { status, data } = await client.request(
          "GET",
          `/api/cli/files?project=${encodeURIComponent(opts.project)}&path=${encodeURIComponent(file)}`
        );
        if (status === 404) error(`File not found: ${file}`, 3);
        if (status !== 200) error(`Failed to fetch ${file}: ${JSON.stringify(data)}`, 1);
        const fileData = data as { name: string; content: string };
        content = fileData.content;
        fileName = fileData.name + ".md";
      }

      // Build request body
      const body: Record<string, unknown> = {
        projectId: project!.id,
        content,
        source: opts.source !== "all" ? opts.source : undefined,
        repo: opts.repo,
        minScore: parseFloat(opts.minScore),
        limit: parseInt(opts.limit, 10),
        includeContent: opts.includeContent,
      };

      // Auto-upload if authenticated and not --no-upload
      if (client.isAuthenticated && opts.upload !== false) {
        body.upload = {
          name: fileName,
          destPath: "",
        };
      }

      const { status, data } = await client.request("POST", "/api/cli/related", body);

      if (status !== 200) {
        error(`Related search failed: ${JSON.stringify(data)}`, status === 401 ? 2 : 1);
      }

      const result = data as {
        uploaded?: { path: string; status: string };
        related: { path: string; score: number; content?: string }[];
      };

      if (opts.format === "json") {
        output({
          query: fileName,
          ...(result.uploaded ? { uploaded: result.uploaded } : {}),
          related: result.related,
        }, "json");
      } else {
        if (result.uploaded) {
          process.stderr.write(`Uploaded: ${result.uploaded.path} (${result.uploaded.status})\n`);
        }
        for (const r of result.related) {
          const line = `${r.score.toFixed(2)}  ${r.path}\n`;
          process.stdout.write(line);
          if (r.content) {
            process.stdout.write(`\n--- FILE: ${r.path} ---\n${r.content}\n\n`);
          }
        }
        if (result.related.length === 0) {
          process.stderr.write("No related files found.\n");
        }
      }
    });
}
