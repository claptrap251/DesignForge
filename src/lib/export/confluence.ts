import { prisma } from "@/lib/db";
import { renderMermaidToSvg } from "./mermaid-utils";
import { marked } from "marked";

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

async function renderDesignContentConfluence(
  content: string,
  prefix: string
): Promise<string> {
  try {
    const mermaidRegex = /```mermaid\s*\n([\s\S]*?)(?:```|$)/g;

    // --- First pass: collect all mermaid blocks and their positions ---
    interface MermaidBlock {
      matchIndex: number;
      matchLength: number;
      code: string;
      diagramIdx: number;
    }
    const blocks: MermaidBlock[] = [];
    let mermaidMatch;
    let diagramIdx = 0;
    while ((mermaidMatch = mermaidRegex.exec(content)) !== null) {
      blocks.push({
        matchIndex: mermaidMatch.index,
        matchLength: mermaidMatch[0].length,
        code: mermaidMatch[1].trim(),
        diagramIdx: diagramIdx++,
      });
    }

    // If no mermaid blocks, render entire content as plain markdown
    if (blocks.length === 0) {
      const renderedHtml = await marked.parse(content);
      return `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
    }

    // --- Render all mermaid blocks in parallel (max 4 concurrent) ---
    const renderTasks = blocks.map((block) => async (): Promise<string> => {
      try {
        const svg = await renderMermaidToSvg(block.code, `${prefix}-${block.diagramIdx}`);
        return `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[<div style="display:flex;justify-content:center;padding:16px">${svg}</div>]]></ac:plain-text-body></ac:structured-macro>\n`;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Mermaid render failed for confluence diagram ${prefix}-${block.diagramIdx}:`, err);
        return `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[<div style="background:#f3f4f6;border:1px solid #e5e7eb;padding:16px;border-radius:8px;color:#6b7280;font-style:italic">Diagram render error: ${esc(message)}</div>]]></ac:plain-text-body></ac:structured-macro>\n`;
      }
    });

    const renderedSvgs = await withConcurrencyLimit(renderTasks, 4);

    // --- Second pass: assemble the final output using pre-rendered SVGs ---
    let html = "";
    let lastIdx = 0;
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const before = content.slice(lastIdx, block.matchIndex).trim();
      if (before) {
        const renderedHtml = await marked.parse(before);
        html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
      }
      html += renderedSvgs[i];
      lastIdx = block.matchIndex + block.matchLength;
    }

    const remaining = content.slice(lastIdx).trim();
    if (remaining) {
      const renderedHtml = await marked.parse(remaining);
      html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
    }

    return html;
  } catch (err) {
    console.error("renderDesignContentConfluence failed entirely:", err);
    const renderedHtml = await marked.parse(content);
    return `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[${renderedHtml}]]></ac:plain-text-body></ac:structured-macro>\n`;
  }
}

function renderCommentsConfluence(comments: any[], designContent?: string | null): string {
  if (comments.length === 0) return "";

  // Build a heading map from markdown content for context
  const headingAtLine = buildHeadingMap(designContent);

  let html = `<h4>Review Comments</h4>\n`;
  html += `<table><thead><tr><th>Pin</th><th>Status</th><th>Section</th><th>Author</th><th>Comment</th><th>Replies</th></tr></thead><tbody>\n`;

  for (const comment of comments) {
    const status = comment.resolved ? "Resolved" : "Open";
    const statusColor = comment.resolved ? "#00875A" : "#DE350B";
    const repliesHtml = comment.replies
      .map(
        (r: any) =>
          `<p><strong>${esc(r.authorName)}</strong>: ${esc(r.content)}</p>`
      )
      .join("");

    html += `<tr>`;
    html += `<td>#${comment.pinNumber}</td>`;
    html += `<td><ac:structured-macro ac:name="status"><ac:parameter ac:name="colour">${statusColor}</ac:parameter><ac:parameter ac:name="title">${status}</ac:parameter></ac:structured-macro></td>`;
    const section = getCommentSection(comment, headingAtLine, designContent);
    html += `<td>${section}</td>`;
    html += `<td>${esc(comment.authorName)}</td>`;
    html += `<td>${esc(comment.content)}</td>`;
    html += `<td>${repliesHtml || "—"}</td>`;
    html += `</tr>\n`;
  }

  html += `</tbody></table>\n`;
  return html;
}

/** Build a map of line numbers to the most recent heading above that line */
function buildHeadingMap(content?: string | null): Map<number, string> {
  const map = new Map<number, string>();
  if (!content) return map;
  const lines = content.split("\n");
  let currentHeading = "";
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^#{1,6}\s+(.+)/);
    if (match) currentHeading = match[1].trim();
    if (currentHeading) map.set(i + 1, currentHeading);
  }
  return map;
}

/** Get a human-readable section string for a comment */
function getCommentSection(
  comment: any,
  headingAtLine: Map<number, string>,
  designContent?: string | null
): string {
  // Anchor-line based comments (not currently used, but supported)
  if (comment.anchorLine != null) {
    const heading = comment.anchorHeading || headingAtLine.get(comment.anchorLine);
    const lines = designContent?.split("\n") || [];
    const lineText = lines[comment.anchorLine - 1]?.trim() || "";
    const parts: string[] = [];
    if (heading) parts.push(`<strong>${esc(heading)}</strong>`);
    if (lineText && lineText !== heading && !lineText.startsWith("#")) {
      const snippet = lineText.length > 60 ? lineText.slice(0, 57) + "..." : lineText;
      parts.push(`<em>"${esc(snippet)}"</em>`);
    }
    if (parts.length > 0) return parts.join("<br/>");
    return `Line ${comment.anchorLine}`;
  }
  // Pin-based comment on markdown content — estimate section from yPercent
  if (designContent && comment.yPercent != null) {
    const heading = estimateHeadingFromYPercent(designContent, comment.yPercent);
    if (heading) return `<strong>${esc(heading)}</strong>`;
  }
  // Image pin — no text context available
  return `Pin #${comment.pinNumber}`;
}

/**
 * Estimate which heading a pin comment falls under based on yPercent.
 * We split the document into equal-height "lines" and find which heading
 * is above the line corresponding to the yPercent position.
 */
function estimateHeadingFromYPercent(content: string, yPercent: number): string | null {
  const lines = content.split("\n");
  const totalLines = lines.length;
  if (totalLines === 0) return null;
  const estimatedLine = Math.max(1, Math.round((yPercent / 100) * totalLines));
  // Walk backwards from the estimated line to find the nearest heading above
  for (let i = estimatedLine - 1; i >= 0; i--) {
    const match = lines[i].match(/^#{1,6}\s+(.+)/);
    if (match) return match[1].trim();
  }
  return null;
}

export async function exportToConfluence(projectId: string): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      folders: {
        orderBy: { order: "asc" },
        include: {
          designs: {
            orderBy: { order: "asc" },
            include: {
              comments: {
                orderBy: { pinNumber: "asc" },
                include: {
                  replies: { orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return "<p>Project not found</p>";

  let html = `<h1>${esc(project.name)}</h1>\n`;
  if (project.description) {
    html += `<p>${esc(project.description)}</p>\n`;
  }
  html += `<hr/>\n`;

  for (const folder of project.folders) {
    html += `<h2>${esc(folder.name)}</h2>\n`;

    for (const design of folder.designs) {
      html += `<h3>${esc(design.name)}</h3>\n`;

      if (design.type === "IMAGE" && design.filePath) {
        html += `<ac:image><ri:attachment ri:filename="${esc(design.filePath)}" /></ac:image>\n`;
      } else if (design.type === "MARKDOWN" && design.content) {
        html += await renderDesignContentConfluence(design.content, "confluence");
      }

      html += renderCommentsConfluence(design.comments, design.content);
    }
  }

  return html;
}

/** Export a single design as Confluence markup */
export async function exportDesignToConfluence(designId: string): Promise<string> {
  const design = await prisma.design.findUnique({
    where: { id: designId },
    include: {
      comments: {
        orderBy: { pinNumber: "asc" },
        include: {
          replies: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  if (!design) return "<p>Design not found</p>";

  let html = `<h1>${esc(design.name)}</h1>\n`;

  if (design.type === "IMAGE" && design.filePath) {
    html += `<ac:image><ri:attachment ri:filename="${esc(design.filePath)}" /></ac:image>\n`;
  } else if (design.type === "MARKDOWN" && design.content) {
    html += await renderDesignContentConfluence(design.content, "confluence-design");
  }

  html += renderCommentsConfluence(design.comments, design.content);

  return html;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
