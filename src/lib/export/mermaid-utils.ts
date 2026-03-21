/**
 * Parses markdown content and extracts mermaid code blocks,
 * returning HTML with mermaid diagram placeholders.
 */

/** Extract mermaid blocks from markdown, return HTML with proper rendering */
export function markdownToHtmlWithMermaid(content: string): string {
  // Split content into segments: regular markdown and mermaid blocks
  const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let result = "";
  let lastIndex = 0;

  let match;
  while ((match = mermaidBlockRegex.exec(content)) !== null) {
    // Add the markdown before this mermaid block as escaped text
    const before = content.slice(lastIndex, match.index);
    if (before.trim()) {
      result += `<div class="markdown-text"><pre>${esc(before)}</pre></div>`;
    }

    // Add the mermaid block as a renderable diagram
    const mermaidCode = match[1].trim();
    result += `<div class="mermaid">${esc(mermaidCode)}</div>`;

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining content after the last mermaid block
  const remaining = content.slice(lastIndex);
  if (remaining.trim()) {
    result += `<div class="markdown-text"><pre>${esc(remaining)}</pre></div>`;
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
  const regex = /```mermaid\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
