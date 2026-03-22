import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { exportDesignToMarkdown } from "@/lib/export/markdown";
import { exportDesignToHtml } from "@/lib/export/html";
import { exportDesignToDocx } from "@/lib/export/docx";
import { exportDesignToConfluence } from "@/lib/export/confluence";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const design = await prisma.design.findUnique({
    where: { id },
    select: { id: true, name: true },
  });

  if (!design) {
    return NextResponse.json({ error: "Design not found" }, { status: 404 });
  }

  const format = request.nextUrl.searchParams.get("format") || "md";
  const safeName = design.name.replace(/[^a-zA-Z0-9_-]/g, "_");

  switch (format) {
    case "md": {
      const markdown = await exportDesignToMarkdown(id);
      return new NextResponse(markdown, {
        headers: {
          "Content-Type": "text/markdown",
          "Content-Disposition": `attachment; filename="${safeName}.md"`,
        },
      });
    }

    case "html": {
      const htmlBuffer = await exportDesignToHtml(id);
      return new NextResponse(new Uint8Array(htmlBuffer), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeName}.html"`,
        },
      });
    }

    case "docx": {
      const docxBuffer = await exportDesignToDocx(id);
      return new NextResponse(new Uint8Array(docxBuffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeName}.docx"`,
        },
      });
    }

    case "confluence": {
      const confluenceHtml = await exportDesignToConfluence(id);
      return new NextResponse(confluenceHtml, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="${safeName}-confluence.html"`,
        },
      });
    }

    default:
      return NextResponse.json(
        { error: "Unsupported format. Use: md, html, docx, confluence" },
        { status: 400 }
      );
  }
}
