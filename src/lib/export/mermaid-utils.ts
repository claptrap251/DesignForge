/**
 * Mermaid rendering utilities using @mermaid-js/mermaid-cli (mmdc).
 * Renders diagrams via headless Chromium for reliable SVG/PNG output.
 */

import { writeFile, readFile, rm, mkdtemp } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import { marked } from "marked";

const execFileAsync = promisify(execFile);

/** Resolve the mmdc binary path from node_modules/.bin */
function getMmdcPath(): string {
  // The @mermaid-js/mermaid-cli package restricts CJS require.resolve via
  // its exports map, so we locate the mmdc binary through the .bin symlink.
  const binPath = path.resolve(process.cwd(), "node_modules/.bin/mmdc");
  return binPath;
}

const MMDC_PATH = getMmdcPath();

/**
 * Puppeteer config for Docker/CI (non-root users).
 * Chromium requires --no-sandbox when running as non-root.
 */
let puppeteerConfigPath: string | null = null;
async function getPuppeteerConfigPath(): Promise<string> {
  if (puppeteerConfigPath) return puppeteerConfigPath;
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), "mermaid-config-"));
  const configPath = path.join(tmpDir, "puppeteer-config.json");
  const config: Record<string, unknown> = {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    config.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  await writeFile(configPath, JSON.stringify(config), "utf-8");
  puppeteerConfigPath = configPath;
  return configPath;
}

/** Error placeholder HTML for failed diagram renders */
function errorPlaceholder(message: string): string {
  const safeMsg = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<div style="background:#f3f4f6;border:1px solid #e5e7eb;padding:16px;border-radius:8px;color:#6b7280;font-style:italic">Diagram render error: ${safeMsg}</div>`;
}

/**
 * Run async tasks with a concurrency limit using a worker-pool pattern.
 * Each worker pulls the next task index atomically (JS is single-threaded)
 * and awaits it before grabbing the next one.
 */
async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const idx = nextIndex++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

/** Render mermaid code to SVG using mmdc CLI */
export async function renderMermaidToSvg(
  code: string,
  id: string
): Promise<string> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `mermaid-${id}-`));
  const inputFile = path.join(tmpDir, "input.mmd");
  const outputFile = path.join(tmpDir, "output.svg");

  try {
    await writeFile(inputFile, code, "utf-8");
    const configPath = await getPuppeteerConfigPath();
    await execFileAsync(
      MMDC_PATH,
      ["-i", inputFile, "-o", outputFile, "-e", "svg", "-p", configPath],
      { timeout: 30000 }
    );
    const svg = await readFile(outputFile, "utf-8");
    return svg;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Render mermaid code to PNG buffer for embedding in docx */
export async function renderMermaidToPng(
  code: string,
  id: string
): Promise<Buffer> {
  const tmpDir = await mkdtemp(path.join(os.tmpdir(), `mermaid-png-${id}-`));
  const inputFile = path.join(tmpDir, "input.mmd");
  const outputFile = path.join(tmpDir, "output.png");

  try {
    await writeFile(inputFile, code, "utf-8");
    const configPath = await getPuppeteerConfigPath();
    await execFileAsync(
      MMDC_PATH,
      ["-i", inputFile, "-o", outputFile, "-e", "png", "-p", configPath],
      { timeout: 30000 }
    );
    const pngBuffer = await readFile(outputFile);
    return Buffer.from(pngBuffer);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Convert markdown with mermaid blocks to HTML with pre-rendered SVGs.
 * Returns the HTML string. Individual diagram failures produce error
 * placeholders — the function itself never throws.
 */
export async function markdownToHtmlWithMermaidSvg(
  content: string
): Promise<string> {
  // Match mermaid fenced blocks — closing fence is optional (handles unclosed blocks)
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)(?:```|$)/g;

  // --- First pass: collect all mermaid blocks and their positions ---
  interface MermaidBlock {
    matchIndex: number;
    matchLength: number;
    code: string;
    diagramIndex: number;
  }
  const blocks: MermaidBlock[] = [];
  let match;
  let diagramIndex = 0;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    blocks.push({
      matchIndex: match.index,
      matchLength: match[0].length,
      code: match[1].trim(),
      diagramIndex: diagramIndex++,
    });
  }

  // --- Render all mermaid blocks in parallel (max 4 concurrent) ---
  const renderTasks = blocks.map((block) => async (): Promise<string> => {
    try {
      const svg = await renderMermaidToSvg(
        block.code,
        `diagram-${block.diagramIndex}`
      );
      return `<div class="mermaid">${svg}</div>`;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("Mermaid render failed:", message);
      return `<div class="mermaid">${errorPlaceholder(message)}</div>`;
    }
  });

  const renderedSvgs = await withConcurrencyLimit(renderTasks, 4);

  // --- Second pass: assemble the final output using pre-rendered SVGs ---
  let result = "";
  let lastIndex = 0;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const before = content.slice(lastIndex, block.matchIndex);
    if (before.trim()) {
      result += `<div class="markdown-text">${await marked.parse(before)}</div>`;
    }
    result += renderedSvgs[i];
    lastIndex = block.matchIndex + block.matchLength;
  }

  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    result += `<div class="markdown-text">${await marked.parse(remaining)}</div>`;
  }

  return result;
}

/** Check if markdown content contains mermaid code blocks */
export function containsMermaid(content: string): boolean {
  return /```mermaid\s*\n/.test(content);
}

/** Extract just the mermaid code blocks from markdown */
export function extractMermaidBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```mermaid\s*\n([\s\S]*?)(?:```|$)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}
