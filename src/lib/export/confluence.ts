import { prisma } from "@/lib/db";

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
        html += `<ac:structured-macro ac:name="code"><ac:plain-text-body><![CDATA[${design.content}]]></ac:plain-text-body></ac:structured-macro>\n`;
      }

      if (design.comments.length > 0) {
        html += `<h4>Review Comments</h4>\n`;
        html += `<table><thead><tr><th>Pin</th><th>Status</th><th>Position</th><th>Author</th><th>Comment</th><th>Replies</th></tr></thead><tbody>\n`;

        for (const comment of design.comments) {
          const status = comment.resolved ? "Resolved" : "Open";
          const statusColor = comment.resolved ? "#00875A" : "#DE350B";
          const repliesHtml = comment.replies
            .map(
              (r) =>
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
      }
    }
  }

  return html;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
