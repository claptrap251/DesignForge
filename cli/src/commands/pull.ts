import { Command } from "commander";
import { DFClient } from "../client";
import { Format, output, error, extractLinks, resolveLink, stripMdExtension, normalizePath } from "../utils";

export function pullCommand(getClient: () => DFClient): Command {
  return new Command("pull")
    .description("Fetch a markdown file and its linked files from DesignForge")
    .argument("<path>", "File path within the project")
    .requiredOption("--project <name|id>", "Project scope")
    .option("--depth <n>", "Max link traversal depth", "3")
    .option("--format <format>", "Output format: text or json", "text")
    .action(async (filePath: string, opts: { project: string; depth: string; format: Format }) => {
      const client = getClient();
      const depth = parseInt(opts.depth, 10);
      const visited = new Set<string>();
      const files: { path: string; content: string }[] = [];

      async function fetchFile(path: string, currentDepth: number): Promise<void> {
        const normalized = normalizePath(stripMdExtension(path));
        if (visited.has(normalized)) return;
        visited.add(normalized);

        const { status, data } = await client.request(
          "GET",
          `/api/cli/files?project=${encodeURIComponent(opts.project)}&path=${encodeURIComponent(normalized)}`
        );

        if (status === 404) return; // silently skip missing files
        if (status !== 200) {
          error(`Failed to fetch ${path}: ${JSON.stringify(data)}`, status === 401 || status === 403 ? 2 : 1);
        }

        const file = data as { path: string; name: string; content: string };
        files.push({ path: file.path, content: file.content || "" });

        if (currentDepth < depth && file.content) {
          const links = extractLinks(file.content);
          for (const link of links) {
            const resolved = resolveLink(file.path, link);
            await fetchFile(resolved, currentDepth + 1);
          }
        }
      }

      await fetchFile(filePath, 0);

      if (files.length === 0) {
        error(`File not found: ${filePath}`, 3);
      }

      if (opts.format === "json") {
        output({ files }, "json");
      } else {
        let text = "";
        for (const f of files) {
          text += `--- FILE: ${f.path} ---\n${f.content}\n\n`;
        }
        process.stdout.write(text);
      }
    });
}
