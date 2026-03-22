import { prisma } from "@/lib/db";
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Packer,
  BorderStyle,
  ShadingType,
  ImageRun,
} from "docx";
import { extractMermaidBlocks, renderMermaidToPng } from "./mermaid-utils";

export async function exportToDocx(projectId: string): Promise<Buffer> {
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

  const children: (Paragraph | Table)[] = [];

  children.push(
    new Paragraph({
      text: project.name,
      heading: HeadingLevel.TITLE,
    })
  );

  if (project.description) {
    children.push(
      new Paragraph({
        text: project.description,
        spacing: { after: 200 },
      })
    );
  }

  for (const folder of project.folders) {
    children.push(
      new Paragraph({
        text: folder.name,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400 },
      })
    );

    for (const design of folder.designs) {
      children.push(
        new Paragraph({
          text: design.name,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200 },
        })
      );

      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Type: ${design.type}`,
              italics: true,
              color: "666666",
            }),
          ],
        })
      );

      if (design.type === "MARKDOWN" && design.content) {
        const mermaidBlocks = extractMermaidBlocks(design.content);

        if (mermaidBlocks.length > 0) {
          // Split content around mermaid blocks and render each part
          const parts = design.content.split(/```mermaid\s*\n[\s\S]*?```/);

          for (let i = 0; i < parts.length; i++) {
            // Add markdown text part
            if (parts[i].trim()) {
              children.push(
                new Paragraph({
                  text: parts[i].trim(),
                  spacing: { after: 100 },
                })
              );
            }

            // Add mermaid diagram as rendered image
            if (i < mermaidBlocks.length) {
              try {
                const pngBuffer = await renderMermaidToPng(
                  mermaidBlocks[i],
                  `docx-diagram-${i}`
                );
                children.push(
                  new Paragraph({
                    children: [
                      new ImageRun({
                        data: pngBuffer,
                        transformation: { width: 600, height: 400 },
                        type: "png",
                      }),
                    ],
                    spacing: { before: 200, after: 200 },
                  })
                );
              } catch {
                // Fallback: show source code if rendering fails
                children.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Diagram (Mermaid)",
                        bold: true,
                        color: "4F46E5",
                        size: 20,
                      }),
                    ],
                    spacing: { before: 200 },
                  })
                );
                const lines = mermaidBlocks[i].split("\n");
                for (const line of lines) {
                  children.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: line,
                          font: "Courier New",
                          size: 18,
                        }),
                      ],
                      shading: {
                        type: ShadingType.SOLID,
                        color: "F3F4F6",
                        fill: "F3F4F6",
                      },
                    })
                  );
                }
              }
            }
          }
        } else {
          // No mermaid, render as plain text
          children.push(
            new Paragraph({
              text: design.content,
              spacing: { after: 200 },
            })
          );
        }
      }

      if (design.comments.length > 0) {
        children.push(
          new Paragraph({
            text: "Review Comments",
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200 },
          })
        );

        const noBorder = {
          style: BorderStyle.SINGLE,
          size: 1,
          color: "CCCCCC",
        };
        const borders = {
          top: noBorder,
          bottom: noBorder,
          left: noBorder,
          right: noBorder,
        };

        const headerRow = new TableRow({
          children: ["Pin", "Status", "Author", "Comment"].map(
            (text) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text, bold: true })],
                  }),
                ],
                borders,
                width: { size: 25, type: WidthType.PERCENTAGE },
              })
          ),
        });

        const rows = [headerRow];

        for (const comment of design.comments) {
          const status = comment.resolved ? "RESOLVED" : "OPEN";
          let commentText = comment.content;

          if (comment.replies.length > 0) {
            commentText += "\n\nReplies:";
            for (const reply of comment.replies) {
              commentText += `\n  ${reply.authorName}: ${reply.content}`;
            }
          }

          rows.push(
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph(`#${comment.pinNumber}`)],
                  borders,
                }),
                new TableCell({
                  children: [new Paragraph(status)],
                  borders,
                }),
                new TableCell({
                  children: [new Paragraph(comment.authorName)],
                  borders,
                }),
                new TableCell({
                  children: [new Paragraph(commentText)],
                  borders,
                }),
              ],
            })
          );
        }

        children.push(
          new Table({
            rows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}
