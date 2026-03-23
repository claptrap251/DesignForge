import { prisma } from "@/lib/db";

export async function exportToMarkdown(projectId: string): Promise<string> {
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

  if (!project) return "# Project not found";

  let md = `# ${project.name}\n\n`;
  if (project.description) {
    md += `${project.description}\n\n`;
  }
  md += `---\n\n`;

  for (const folder of project.folders) {
    md += `## ${folder.name}\n\n`;

    for (const design of folder.designs) {
      md += `### ${design.name}\n\n`;

      if (design.type === "IMAGE" && design.filePath) {
        md += `![${design.name}](${design.filePath})\n\n`;
      } else if (design.type === "MARKDOWN" && design.content) {
        md += `${design.content}\n\n`;
      }

      if (design.comments.length > 0) {
        md += `#### Comments\n\n`;
        for (const comment of design.comments) {
          const status = comment.resolved ? "RESOLVED" : "OPEN";
          const position = comment.anchorLine != null
            ? `Line ${comment.anchorLine}`
            : `position (${comment.xPercent?.toFixed(1) ?? '?'}%, ${comment.yPercent?.toFixed(1) ?? '?'}%)`;
          md += `> **[Pin #${comment.pinNumber}]** (${status}) at ${position}\n`;
          md += `> **${comment.authorName}** — ${new Date(comment.createdAt).toLocaleDateString()}\n`;
          md += `> ${comment.content}\n`;

          for (const reply of comment.replies) {
            md += `>> **${reply.authorName}** — ${new Date(reply.createdAt).toLocaleDateString()}\n`;
            md += `>> ${reply.content}\n`;
          }

          md += `\n`;
        }
      }
    }
  }

  return md;
}

/** Export a single design as markdown (with comments) */
export async function exportDesignToMarkdown(designId: string): Promise<string> {
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

  if (!design) return "# Design not found";

  let md = `# ${design.name}\n\n`;

  if (design.type === "IMAGE" && design.filePath) {
    md += `![${design.name}](${design.filePath})\n\n`;
  } else if (design.type === "MARKDOWN" && design.content) {
    md += `${design.content}\n\n`;
  }

  if (design.comments.length > 0) {
    md += `## Comments\n\n`;
    for (const comment of design.comments) {
      const status = comment.resolved ? "RESOLVED" : "OPEN";
      const position = comment.anchorLine != null
        ? `Line ${comment.anchorLine}`
        : `position (${comment.xPercent?.toFixed(1) ?? '?'}%, ${comment.yPercent?.toFixed(1) ?? '?'}%)`;
      md += `> **[Pin #${comment.pinNumber}]** (${status}) at ${position}\n`;
      md += `> **${comment.authorName}** — ${new Date(comment.createdAt).toLocaleDateString()}\n`;
      md += `> ${comment.content}\n`;

      for (const reply of comment.replies) {
        md += `>> **${reply.authorName}** — ${new Date(reply.createdAt).toLocaleDateString()}\n`;
        md += `>> ${reply.content}\n`;
      }

      md += `\n`;
    }
  }

  return md;
}
