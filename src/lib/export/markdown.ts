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
        const headingMap = buildHeadingMap(design.content);
        for (const comment of design.comments) {
          const status = comment.resolved ? "RESOLVED" : "OPEN";
          const section = getCommentSectionMd(comment, headingMap, design.content);
          md += `> **[Pin #${comment.pinNumber}]** (${status}) in ${section}\n`;
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
    const headingMap = buildHeadingMap(design.content);
    for (const comment of design.comments) {
      const status = comment.resolved ? "RESOLVED" : "OPEN";
      const section = getCommentSectionMd(comment, headingMap, design.content);
      md += `> **[Pin #${comment.pinNumber}]** (${status}) in ${section}\n`;
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

function getCommentSectionMd(
  comment: any,
  headingAtLine: Map<number, string>,
  designContent?: string | null
): string {
  if (comment.anchorLine != null) {
    const heading = comment.anchorHeading || headingAtLine.get(comment.anchorLine);
    const lines = designContent?.split("\n") || [];
    const lineText = lines[comment.anchorLine - 1]?.trim() || "";
    const parts: string[] = [];
    if (heading) parts.push(`**${heading}**`);
    if (lineText && lineText !== heading && !lineText.startsWith("#")) {
      const snippet = lineText.length > 60 ? lineText.slice(0, 57) + "..." : lineText;
      parts.push(`*"${snippet}"*`);
    }
    if (parts.length > 0) return parts.join(" — ");
    return `Line ${comment.anchorLine}`;
  }
  if (designContent && comment.yPercent != null) {
    const heading = estimateHeadingFromYPercent(designContent, comment.yPercent);
    if (heading) return `**${heading}**`;
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
