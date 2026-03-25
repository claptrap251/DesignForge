"use client";

import { useEffect, useRef, useId, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import remarkSourceLines from "@/lib/remarkSourceLines";

interface MarkdownViewerProps {
  content: string;
  children?: React.ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
  isAddMode?: boolean;
  onLineClick?: (line: number) => void;
  comments?: any[];
  selectedCommentId?: string | null;
  onSelectComment?: (id: string | null) => void;
}

function MermaidBlock({ code }: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniqueId = useId().replace(/:/g, "-");
  const [expanded, setExpanded] = useState(false);
  const [svgHtml, setSvgHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        if (cancelled || !containerRef.current) return;

        const { svg } = await mermaid.render(`mermaid-${uniqueId}`, code);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setSvgHtml(svg);
        }
      } catch (err) {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = `<pre class="text-red-600 text-sm p-4 bg-red-50 rounded-lg">${
            err instanceof Error ? err.message : "Failed to render diagram"
          }</pre>`;
        }
      }
    }

    renderDiagram();
    return () => {
      cancelled = true;
    };
  }, [code, uniqueId]);

  return (
    <>
      <div className="group/mermaid relative my-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div
          ref={containerRef}
          className="flex justify-center overflow-x-auto"
        />
        {svgHtml && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute right-2 top-2 rounded-md bg-white/90 dark:bg-gray-800/90 p-1.5 text-gray-400 shadow-sm backdrop-blur-sm hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 opacity-0 group-hover/mermaid:opacity-100 transition-opacity"
            title="Enlarge diagram"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        )}
      </div>

      {expanded && svgHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl bg-white dark:bg-gray-800 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpanded(false)}
              className="absolute right-3 top-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              title="Close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div
              className="flex justify-center [&_svg]:max-h-[80vh] [&_svg]:w-auto"
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          </div>
        </div>
      )}
    </>
  );
}

export default function MarkdownViewer({
  content,
  children,
  contentRef,
  isAddMode,
  onLineClick,
  comments,
  selectedCommentId,
  onSelectComment,
}: MarkdownViewerProps) {
  const handleContentClick = (e: React.MouseEvent) => {
    if (!isAddMode || !onLineClick) return;

    // Walk up from the clicked element to find one with data-source-line
    let target = e.target as HTMLElement;
    while (target && target !== e.currentTarget) {
      const line = target.getAttribute("data-source-line");
      if (line) {
        onLineClick(parseInt(line, 10));
        return;
      }
      target = target.parentElement!;
    }
  };

  // Build a map of source lines to comments for inline indicators
  const commentsByLine = new Map<number, any[]>();
  if (comments) {
    for (const c of comments) {
      if (c.anchorLine != null) {
        const existing = commentsByLine.get(c.anchorLine) || [];
        existing.push(c);
        commentsByLine.set(c.anchorLine, existing);
      }
    }
  }

  // Attach comment indicators to elements with data-source-line after render
  useEffect(() => {
    if (!contentRef?.current || commentsByLine.size === 0) return;

    // Clean up old indicators
    contentRef.current.querySelectorAll(".comment-indicator").forEach((el) => el.remove());
    contentRef.current.querySelectorAll(".has-comment-highlight").forEach((el) => {
      el.classList.remove("has-comment-highlight");
    });

    for (const [line, lineComments] of commentsByLine) {
      const el = contentRef.current.querySelector(`[data-source-line="${line}"]`);
      if (!el) continue;

      (el as HTMLElement).style.position = "relative";

      const isSelected = lineComments.some((c: any) => c.id === selectedCommentId);
      if (isSelected) {
        el.classList.add("has-comment-highlight");
      }

      const indicator = document.createElement("button");
      indicator.className = "comment-indicator";
      indicator.style.cssText =
        `position:absolute;right:-2rem;top:50%;transform:translateY(-50%);` +
        `width:1.25rem;height:1.25rem;border-radius:9999px;display:flex;align-items:center;justify-content:center;` +
        `font-size:0.625rem;font-weight:700;color:white;cursor:pointer;z-index:5;` +
        `background:${lineComments[0].resolved ? "#22c55e" : "#4f46e5"};` +
        `${isSelected ? "box-shadow:0 0 0 2px #f87171;" : ""}`;
      indicator.textContent = String(lineComments[0].pinNumber);
      indicator.onclick = (ev) => {
        ev.stopPropagation();
        onSelectComment?.(lineComments[0].id);
      };
      el.appendChild(indicator);
    }

    return () => {
      if (!contentRef?.current) return;
      contentRef.current.querySelectorAll(".comment-indicator").forEach((el) => el.remove());
      contentRef.current.querySelectorAll(".has-comment-highlight").forEach((el) => {
        el.classList.remove("has-comment-highlight");
      });
    };
  });

  return (
    <div className="h-full w-full overflow-auto bg-white dark:bg-gray-900">
      <div className="relative min-h-full mx-auto w-[900px] max-w-full">
        <div
          ref={contentRef}
          className={`px-16 py-12 ${
            isAddMode ? "cursor-crosshair" : "cursor-text select-text"
          }`}
          onClick={handleContentClick}
        >
          <article className="prose prose-lg prose-gray dark:prose-invert max-w-none leading-relaxed prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-6 prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-5 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-4 prose-p:my-5 prose-p:leading-8 prose-li:my-2 prose-li:leading-7 prose-ul:my-5 prose-ol:my-5 prose-blockquote:my-6 prose-blockquote:pl-5 prose-hr:my-10 prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-code:rounded prose-code:bg-gray-100 dark:prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950 prose-pre:text-gray-100 prose-pre:my-8 prose-pre:p-5 prose-table:my-8 prose-img:my-8 prose-figure:my-8 prose-strong:text-gray-900 dark:prose-strong:text-gray-100">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkSourceLines]}
              rehypePlugins={[rehypeSlug]}
              components={{
                code({ className, children: codeChildren, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const lang = match ? match[1] : "";
                  const codeStr = String(codeChildren).replace(/\n$/, "");

                  if (lang === "mermaid") {
                    return <MermaidBlock code={codeStr} />;
                  }

                  if (lang) {
                    return (
                      <pre className="overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm text-gray-100">
                        <code className={className} {...props}>
                          {codeChildren}
                        </code>
                      </pre>
                    );
                  }

                  return (
                    <code className={className} {...props}>
                      {codeChildren}
                    </code>
                  );
                },
              }}
            >
              {content}
            </ReactMarkdown>
          </article>
        </div>
        {children && (
          isAddMode
            ? <div className="absolute inset-0">{children}</div>
            : children
        )}
      </div>
    </div>
  );
}
