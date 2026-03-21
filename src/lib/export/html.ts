import { prisma } from "@/lib/db";
import { containsMermaid, markdownToHtmlWithMermaidSvg } from "./mermaid-utils";
import { marked } from "marked";

const HTML_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
  h1 { color: #4F46E5; border-bottom: 2px solid #4F46E5; padding-bottom: 8px; }
  h2 { color: #1F2937; margin-top: 30px; }
  h3 { color: #374151; }
  .comment { background: #F3F4F6; border-left: 3px solid #4F46E5; padding: 12px; margin: 8px 0; border-radius: 4px; }
  .comment.resolved { border-left-color: #10B981; opacity: 0.7; }
  .reply { margin-left: 20px; padding: 8px; background: #E5E7EB; border-radius: 4px; margin-top: 4px; }
  .pin-badge { display: inline-block; background: #4F46E5; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 8px; }
  .pin-badge.resolved { background: #10B981; }
  .meta { font-size: 12px; color: #6B7280; }
  .status { font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 3px; }
  .status.open { background: #FEE2E2; color: #DC2626; }
  .status.resolved { background: #D1FAE5; color: #059669; }
  table { width: 100%; border-collapse: collapse; margin: 10px 0; }
  th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; font-size: 13px; }
  th { background: #F9FAFB; font-weight: 600; }
  .markdown-content { background: #F9FAFB; padding: 16px; border-radius: 8px; margin: 8px 0; }
  .markdown-text pre { white-space: pre-wrap; word-wrap: break-word; margin: 0; }
  .mermaid { display: flex; justify-content: center; padding: 16px; margin: 16px 0; background: white; border: 1px solid #E5E7EB; border-radius: 8px; }
  .mermaid svg { max-width: 100%; height: auto; }
  @media print { .mermaid svg { max-width: 100%; } }
`;

function buildHtmlDocument(bodyContent: string): Buffer {
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>${HTML_STYLES}</style>
</head>
<body>${bodyContent}</body></html>`;
  return Buffer.from(html, "utf-8");
}

function renderCommentsHtml(comments: any[], designContent?: string | null): string {
  if (comments.length === 0) return "";

  const headingAtLine = buildHeadingMap(designContent);

  let html = `<h4>Comments</h4>`;

  for (const comment of comments) {
    const resolvedClass = comment.resolved ? "resolved" : "";
    const statusText = comment.resolved ? "RESOLVED" : "OPEN";
    const statusClass = comment.resolved ? "resolved" : "open";

    html += `<div class="comment ${resolvedClass}">`;
    html += `<span class="pin-badge ${resolvedClass}">${comment.pinNumber}</span>`;
    html += `<span class="status ${statusClass}">${statusText}</span>`;
    const section = getCommentSectionHtml(comment, headingAtLine, designContent);
    html += ` <span class="meta">in ${section} by <strong>${esc(comment.authorName)}</strong></span>`;
    html += `<p>${esc(comment.content)}</p>`;

    for (const reply of comment.replies) {
      html += `<div class="reply"><strong>${esc(reply.authorName)}</strong>: ${esc(reply.content)}</div>`;
    }

    html += `</div>`;
  }

  return html;
}

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

function getCommentSectionHtml(
  comment: any,
  headingAtLine: Map<number, string>,
  designContent?: string | null
): string {
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
    if (parts.length > 0) return parts.join(" &mdash; ");
    return `Line ${comment.anchorLine}`;
  }
  if (designContent && comment.yPercent != null) {
    const heading = estimateHeadingFromYPercent(designContent, comment.yPercent);
    if (heading) return `<strong>${esc(heading)}</strong>`;
  }
  return `Pin #${comment.pinNumber}`;
}

function estimateHeadingFromYPercent(content: string, yPercent: number): string | null {
  const lines = content.split("\n");
  const totalLines = lines.length;
  if (totalLines === 0) return null;
  const estimatedLine = Math.max(1, Math.round((yPercent / 100) * totalLines));
  for (let i = estimatedLine - 1; i >= 0; i--) {
    const match = lines[i].match(/^#{1,6}\s+(.+)/);
    if (match) return match[1].trim();
  }
  return null;
}

async function renderDesignContentHtml(content: string): Promise<string> {
  if (!containsMermaid(content)) {
    const rendered = await marked.parse(content);
    return `<div class="markdown-content">${rendered}</div>`;
  }
  const rendered = await markdownToHtmlWithMermaidSvg(content);
  return `<div class="markdown-content">${rendered}</div>`;
}

export async function exportToHtml(projectId: string): Promise<Buffer> {
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

  if (!project) {
    return Buffer.from("Project not found");
  }

  let body = `<h1>${esc(project.name)}</h1>`;
  if (project.description) {
    body += `<p>${esc(project.description)}</p>`;
  }

  for (const folder of project.folders) {
    body += `<h2>${esc(folder.name)}</h2>`;

    for (const design of folder.designs) {
      body += `<h3>${esc(design.name)} <span class="meta">(${design.type})</span></h3>`;

      if (design.type === "MARKDOWN" && design.content) {
        body += await renderDesignContentHtml(design.content);
      }

      body += renderCommentsHtml(design.comments, design.content);
    }
  }

  return buildHtmlDocument(body);
}

/** Export a single design as HTML */
export async function exportDesignToHtml(designId: string): Promise<Buffer> {
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

  if (!design) {
    return Buffer.from("Design not found");
  }

  let body = `<h1>${esc(design.name)} <span class="meta">(${design.type})</span></h1>`;

  if (design.type === "MARKDOWN" && design.content) {
    body += await renderDesignContentHtml(design.content);
  }

  body += renderCommentsHtml(design.comments, design.content);

  return buildHtmlDocument(body);
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
