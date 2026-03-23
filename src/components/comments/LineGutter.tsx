"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { resolveAnchor } from "@/lib/anchor";
import type { AnchorResult } from "@/lib/anchor";

interface LineGutterProps {
  markdownContent: string;
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (line: number) => void;
  isAddMode: boolean;
  contentRef: React.RefObject<HTMLDivElement | null>;
}

type ResolvedComment = {
  comment: any;
  anchor: AnchorResult;
};

export default function LineGutter({
  markdownContent,
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  isAddMode,
  contentRef,
}: LineGutterProps) {
  const [hoveredLine, setHoveredLine] = useState<number | null>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Resolve comment anchors against current content
  const resolvedComments: ResolvedComment[] = comments
    .filter((c: any) => c.anchorLine != null)
    .map((c: any) => ({
      comment: c,
      anchor: resolveAnchor(c, markdownContent),
    }));

  const totalLines = markdownContent.split("\n").length;

  // Get comments at a specific line
  const commentsAtLine = useCallback(
    (line: number) =>
      resolvedComments.filter(
        (rc) => rc.anchor.confidence !== "orphaned" && rc.anchor.line === line
      ),
    [resolvedComments]
  );

  const handleLineClick = (line: number) => {
    if (isAddMode) {
      onAddComment(line);
    }
  };

  const scrollToLine = (line: number) => {
    if (!contentRef.current) return;
    const el = contentRef.current.querySelector(
      `[data-source-line="${line}"]`
    );
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement).classList.add("bg-yellow-100");
      setTimeout(() => (el as HTMLElement).classList.remove("bg-yellow-100"), 1500);
    }
  };

  return (
    <div ref={gutterRef} className="select-none border-r border-gray-200 bg-gray-50 py-6" style={{ minWidth: "2.5rem" }}>
      {Array.from({ length: totalLines }, (_, i) => {
        const line = i + 1;
        const lineComments = commentsAtLine(line);
        const hasComments = lineComments.length > 0;

        return (
          <div
            key={line}
            className={`relative flex items-center justify-end pr-1 text-xs leading-6 ${
              isAddMode ? "cursor-pointer hover:bg-indigo-50" : ""
            } ${hoveredLine === line ? "bg-indigo-50" : ""}`}
            style={{ height: "1.5rem" }}
            onMouseEnter={() => setHoveredLine(line)}
            onMouseLeave={() => setHoveredLine(null)}
            onClick={() => handleLineClick(line)}
          >
            {hasComments ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectComment(lineComments[0].comment.id);
                  scrollToLine(line);
                }}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                  lineComments[0].comment.resolved ? "bg-green-500" : "bg-indigo-600"
                } ${
                  selectedCommentId === lineComments[0].comment.id ? "ring-2 ring-red-400" : ""
                }`}
                title={`Pin #${lineComments[0].comment.pinNumber}`}
              >
                {lineComments[0].comment.pinNumber}
              </button>
            ) : isAddMode && hoveredLine === line ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-600">
                +
              </span>
            ) : (
              <span className="text-gray-300">{line}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
