import { prisma } from "@/lib/db";

export async function exportToPdf(projectId: string): Promise<Buffer> {
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

  // Generate a styled HTML document that can be printed to PDF
  // Using HTML-to-PDF approach for simplicity and reliability
  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
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
</style>
</head>
<body>`;

  html += `<h1>${esc(project.name)}</h1>`;
  if (project.description) {
    html += `<p>${esc(project.description)}</p>`;
  }

  for (const folder of project.folders) {
    html += `<h2>${esc(folder.name)}</h2>`;

    for (const design of folder.designs) {
      html += `<h3>${esc(design.name)} <span class="meta">(${design.type})</span></h3>`;

      if (design.type === "MARKDOWN" && design.content) {
        html += `<div class="markdown-content"><pre>${esc(design.content)}</pre></div>`;
      }

      if (design.comments.length > 0) {
        html += `<h4>Comments</h4>`;

        for (const comment of design.comments) {
          const resolvedClass = comment.resolved ? "resolved" : "";
          const statusText = comment.resolved ? "RESOLVED" : "OPEN";
          const statusClass = comment.resolved ? "resolved" : "open";

          html += `<div class="comment ${resolvedClass}">`;
          html += `<span class="pin-badge ${resolvedClass}">${comment.pinNumber}</span>`;
          html += `<span class="status ${statusClass}">${statusText}</span>`;
          html += ` <span class="meta">at (${comment.xPercent.toFixed(1)}%, ${comment.yPercent.toFixed(1)}%) by <strong>${esc(comment.authorName)}</strong></span>`;
          html += `<p>${esc(comment.content)}</p>`;

          for (const reply of comment.replies) {
            html += `<div class="reply"><strong>${esc(reply.authorName)}</strong>: ${esc(reply.content)}</div>`;
          }

          html += `</div>`;
        }
      }
    }
  }

  html += `</body></html>`;

  // Return as HTML buffer - browsers can print to PDF, or use a server-side tool
  return Buffer.from(html, "utf-8");
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
