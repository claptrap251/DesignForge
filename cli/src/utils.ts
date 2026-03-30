export type Format = "text" | "json";

export function output(data: unknown, format: Format): void {
  if (format === "json") {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  } else {
    process.stdout.write(String(data));
  }
}

export function error(msg: string, code: number = 1): never {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(code);
}

export function warn(msg: string): void {
  process.stderr.write(`Warning: ${msg}\n`);
}

export function normalizePath(p: string): string {
  return p
    .replace(/^\.\//, "")
    .replace(/\/+/g, "/")
    .replace(/\/$/, "");
}

export function stripMdExtension(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "");
}

export function extractLinks(content: string): string[] {
  const links: string[] = [];

  const mdLinkRegex = /\[([^\]]*)\]\(([^)]+\.(?:md|markdown))\)/gi;
  let match;
  while ((match = mdLinkRegex.exec(content)) !== null) {
    const href = match[2];
    if (href.startsWith("http://") || href.startsWith("https://")) continue;
    links.push(href);
  }

  const wikiRegex = /\[\[([^\]]+)\]\]/g;
  while ((match = wikiRegex.exec(content)) !== null) {
    links.push(match[1]);
  }

  return links;
}

export function resolveLink(basePath: string, link: string): string {
  const parts = basePath.split("/");
  parts.pop();
  const baseDir = parts.join("/");

  if (link.startsWith("/")) {
    return normalizePath(link.slice(1));
  }

  const combined = baseDir ? `${baseDir}/${link}` : link;

  const segments = combined.split("/");
  const resolved: string[] = [];
  for (const seg of segments) {
    if (seg === "." || seg === "") continue;
    if (seg === "..") {
      resolved.pop();
    } else {
      resolved.push(seg);
    }
  }

  return normalizePath(resolved.join("/"));
}
