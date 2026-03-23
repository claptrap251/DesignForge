"use client";

import { useEffect, useRef, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkSourceLines from "@/lib/remarkSourceLines";

interface MarkdownViewerProps {
  content: string;
  children?: React.ReactNode;
  contentRef?: React.RefObject<HTMLDivElement | null>;
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

export default function MarkdownViewer({ content, children, contentRef }: MarkdownViewerProps) {
  return (
    <div className="relative h-full w-full overflow-auto bg-white">
      <div ref={contentRef} className="mx-auto max-w-full sm:max-w-2xl lg:max-w-4xl px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        <article className="prose prose-gray max-w-none prose-headings:text-gray-900 prose-a:text-indigo-600 prose-code:rounded prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-gray-900 prose-pre:text-gray-100">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkSourceLines]}
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
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}
