import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { exportToMarkdown } from "@/lib/export/markdown";
import { exportToPdf } from "@/lib/export/pdf";
import { exportToDocx } from "@/lib/export/docx";
import { exportToConfluence } from "@/lib/export/confluence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") || "md";

  switch (format) {
    case "md": {
      const markdown = await exportToMarkdown(projectId);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${project.name}.md"`,
        },
      });
    }

    case "confluence": {
      const html = await exportToConfluence(projectId);
      return new NextResponse(html, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${project.name}.html"`,
        },
      });
    }

    case "pdf": {
      const pdfBuffer = await exportToPdf(projectId);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${project.name}.pdf"`,
        },
      });
    }

    case "docx": {
      const docxBuffer = await exportToDocx(projectId);
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${project.name}.docx"`,
        },
      });
    }

    default:
      return NextResponse.json(
        { error: "Unsupported format. Use: md, pdf, docx, confluence" },
        { status: 400 }
      );
  }
}
