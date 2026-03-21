"use client";

import { useEffect, useRef, useId } from "react";
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
    <div
      ref={containerRef}
      className="my-4 flex justify-center overflow-x-auto rounded-lg border border-gray-200 bg-white p-4"
    />
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
      <div className="relative min-h-full">
        <div
          ref={contentRef}
          className={`mx-auto max-w-full lg:max-w-5xl px-6 sm:px-10 lg:px-16 py-8 sm:py-12 ${
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
