import { describe, it, expect, beforeEach } from "vitest";
import {
  prisma,
  cleanDb,
  createTestProject,
  createTestFolder,
  createTestMarkdownDesign,
} from "./helpers";
import { exportToMarkdown } from "@/lib/export/markdown";
import { exportToHtml } from "@/lib/export/html";
import { exportToConfluence } from "@/lib/export/confluence";
import {
  markdownToHtmlWithMermaid,
  containsMermaid,
  extractMermaidBlocks,
} from "@/lib/export/mermaid-utils";

describe("Mermaid Utils", () => {
  it("should detect mermaid blocks", () => {
    expect(containsMermaid("```mermaid\ngraph TD\n```")).toBe(true);
    expect(containsMermaid("# No mermaid here")).toBe(false);
    expect(containsMermaid("some `mermaid` text")).toBe(false);
  });

  it("should extract mermaid blocks", () => {
    const md = `# Intro
\`\`\`mermaid
graph TD
    A --> B
\`\`\`

Some text

\`\`\`mermaid
sequenceDiagram
    A->>B: Hello
\`\`\``;

    const blocks = extractMermaidBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain("graph TD");
    expect(blocks[1]).toContain("sequenceDiagram");
  });

  it("should convert mermaid blocks to renderable divs without escaping", () => {
    const md = `Intro text
\`\`\`mermaid
graph TD
    A[User] --> B[Server]
\`\`\`
Outro text`;

    const html = markdownToHtmlWithMermaid(md);

    // Mermaid content should NOT be escaped
    expect(html).toContain('<div class="mermaid">graph TD');
    expect(html).toContain("A[User] --> B[Server]");
    // Should NOT contain escaped arrows in mermaid div
    expect(html).not.toContain('<div class="mermaid">graph TD\n    A[User] --&gt;');

    // Non-mermaid text SHOULD be escaped
    expect(html).toContain('<div class="markdown-text">');
  });

  it("should handle content with no mermaid blocks", () => {
    const md = "Just plain text\nwith multiple lines";
    const html = markdownToHtmlWithMermaid(md);

    expect(html).toContain("Just plain text");
    expect(html).not.toContain("mermaid");
  });
});

describe("Markdown Export", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    const folder = await createTestFolder(project.id, "UI Screens");
    const design = await createTestMarkdownDesign(
      folder.id,
      "# Architecture\n\n```mermaid\ngraph TD\n    A --> B\n```"
    );

    // Add a comment
    await prisma.comment.create({
      data: {
        designId: design.id,
        xPercent: 25.5,
        yPercent: 40.0,
        pinNumber: 1,
        content: "Add error handling",
        authorName: "Alice",
      },
    });
  });

  it("should export markdown with project name and description", async () => {
    const md = await exportToMarkdown(projectId);

    expect(md).toContain("# Test Project");
    expect(md).toContain("A test project");
  });

  it("should include folder and design names", async () => {
    const md = await exportToMarkdown(projectId);

    expect(md).toContain("## UI Screens");
    expect(md).toContain("### Test Design");
  });

  it("should preserve mermaid blocks in markdown export", async () => {
    const md = await exportToMarkdown(projectId);

    expect(md).toContain("```mermaid");
    expect(md).toContain("graph TD");
    expect(md).toContain("A --> B");
  });

  it("should include comments in markdown export", async () => {
    const md = await exportToMarkdown(projectId);

    expect(md).toContain("Pin #1");
    expect(md).toContain("Alice");
    expect(md).toContain("Add error handling");
  });

  it("should return fallback for nonexistent project", async () => {
    const md = await exportToMarkdown("nonexistent-id");
    expect(md).toContain("not found");
  });
});

describe("HTML Export", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    const folder = await createTestFolder(project.id, "Screens");
    const design = await createTestMarkdownDesign(
      folder.id,
      "# Design Review Flow\n\n```mermaid\nflowchart TD\n    A[Designer uploads design] --> B[Team notified]\n    B --> C{Review started}\n```\n\n## Goals\n\n- Increase CTA rate"
    );

    await prisma.comment.create({
      data: {
        designId: design.id,
        xPercent: 25.6,
        yPercent: 51.0,
        pinNumber: 1,
        content: "Needs update",
        authorName: "Aayush",
      },
    });
  });

  it("should render mermaid diagrams as inline SVGs", async () => {
    const buf = await exportToHtml(projectId);
    const html = buf.toString("utf-8");

    // Should contain pre-rendered SVG, not raw mermaid code or CDN script
    expect(html).toContain("<svg");
    expect(html).toContain('<div class="mermaid">');
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("import mermaid from");
    // Raw mermaid source should NOT appear in the output
    expect(html).not.toContain("flowchart TD");
  });

  it("should escape non-mermaid content properly", async () => {
    const buf = await exportToHtml(projectId);
    const html = buf.toString("utf-8");

    expect(html).toContain("Goals");
    expect(html).toContain("Increase CTA rate");
  });

  it("should include comments in HTML export", async () => {
    const buf = await exportToHtml(projectId);
    const html = buf.toString("utf-8");

    expect(html).toContain("Needs update");
    expect(html).toContain("Aayush");
    expect(html).toContain("25.6%");
    expect(html).toContain("51.0%");
  });

  it("should not include SVGs when no mermaid content", async () => {
    await cleanDb();
    const project = await createTestProject();
    const folder = await createTestFolder(project.id, "Plain");
    await createTestMarkdownDesign(folder.id, "# No diagrams here");

    const buf = await exportToHtml(project.id);
    const html = buf.toString("utf-8");

    expect(html).not.toContain("<svg");
    expect(html).not.toContain('<div class="mermaid">');
    expect(html).toContain("No diagrams here");
  });
});

describe("Confluence Export", () => {
  let projectId: string;

  beforeEach(async () => {
    await cleanDb();
    const project = await createTestProject();
    projectId = project.id;
    const folder = await createTestFolder(project.id, "Architecture");
    const design = await createTestMarkdownDesign(
      folder.id,
      "# Flow\n\n```mermaid\ngraph TD\n    A --> B\n```\n\nNotes here"
    );

    await prisma.comment.create({
      data: {
        designId: design.id,
        xPercent: 50,
        yPercent: 50,
        pinNumber: 1,
        content: "Review needed",
        authorName: "Bob",
        resolved: false,
      },
    });
  });

  it("should export Confluence markup with project structure", async () => {
    const html = await exportToConfluence(projectId);

    expect(html).toContain("<h1>");
    expect(html).toContain("Test Project");
    expect(html).toContain("<h2>");
    expect(html).toContain("Architecture");
  });

  it("should render mermaid blocks as inline SVGs", async () => {
    const html = await exportToConfluence(projectId);

    // Should contain rendered SVG inside an HTML macro
    expect(html).toContain('ac:name="html"');
    expect(html).toContain("<svg");
    // Raw mermaid source should not appear
    expect(html).not.toContain("graph TD");
  });

  it("should include comments as a table", async () => {
    const html = await exportToConfluence(projectId);

    expect(html).toContain("Review Comments");
    expect(html).toContain("#1");
    expect(html).toContain("Bob");
    expect(html).toContain("Review needed");
  });

  it("should return fallback for nonexistent project", async () => {
    const html = await exportToConfluence("nonexistent-id");
    expect(html).toContain("not found");
  });
});
