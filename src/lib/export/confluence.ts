import { prisma } from "@/lib/db";
import { renderMermaidToSvg } from "./mermaid-utils";

async function renderDesignContentConfluence(
  content: string,
  prefix: string
): Promise<string> {
  let html = "";
  const mermaidRegex = /```mermaid\s*\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let mermaidMatch;
  let hasParts = false;

  let diagramIdx = 0;
  while ((mermaidMatch = mermaidRegex.exec(content)) !== null) {
    hasParts = true;
    const before = content.slice(lastIdx, mermaidMatch.index).trim();
    if (before) {
      html += `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[${before}]]></ac:plain-text-body></ac:structured-macro>\n`;
    }
    const mermaidCode = mermaidMatch[1].trim();
    const svg = await renderMermaidToSvg(mermaidCode, `${prefix}-${diagramIdx++}`);
    html += `<ac:structured-macro ac:name="html"><ac:plain-text-body><![CDATA[<div style="display:flex;justify-content:center;padding:16px">${svg}</div>]]></ac:plain-text-body></ac:structured-macro>\n`;
    lastIdx = mermaidMatch.index + mermaidMatch[0].length;
  }

  const remaining = content.slice(lastIdx).trim();
  if (remaining) {
    html += `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[${remaining}]]></ac:plain-text-body></ac:structured-macro>\n`;
  }

  if (!hasParts) {
    html += `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[${content}]]></ac:plain-text-body></ac:structured-macro>\n`;
  }

  return html;
}

function renderCommentsConfluence(comments: any[]): string {
  if (comments.length === 0) return "";

  let html = `<h4>Review Comments</h4>\n`;
  html += `<table><thead><tr><th>Pin</th><th>Status</th><th>Position</th><th>Author</th><th>Comment</th><th>Replies</th></tr></thead><tbody>\n`;

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
    html += `<td>(${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%)</td>`;
    html += `<td>${esc(comment.authorName)}</td>`;
    html += `<td>${esc(comment.content)}</td>`;
    html += `<td>${repliesHtml || "—"}</td>`;
    html += `</tr>\n`;
  }

  html += `</tbody></table>\n`;
  return html;
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

      html += renderCommentsConfluence(design.comments);
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

  html += renderCommentsConfluence(design.comments);

  return html;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
