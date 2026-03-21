"use client";

import { useState } from "react";
import CommentThread from "./CommentThread";

interface CommentSidebarProps {
  comments: any[];
  onResolve: (id: string) => void;
  onReply: (commentId: string, content: string, authorName: string) => void;
  selectedCommentId: string | null;
  onSelectComment: (id: string) => void;
}

type FilterType = "all" | "unresolved" | "resolved";

export default function CommentSidebar({
  comments,
  onResolve,
  onReply,
  selectedCommentId,
  onSelectComment,
}: CommentSidebarProps) {
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredComments = comments
    .filter((c) => {
      if (filter === "unresolved") return !c.resolved;
      if (filter === "resolved") return c.resolved;
      return true;
    })
    .sort((a, b) => (a.pinNumber ?? 0) - (b.pinNumber ?? 0));

  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  return (
    <aside className="flex h-full w-80 flex-col border-l border-gray-200 bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Comments</h3>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
            {unresolvedCount} open
          </span>
        </div>
        <div className="mt-2 flex gap-1 rounded-lg bg-gray-100 p-0.5">
          {(["all", "unresolved", "resolved"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {filteredComments.length === 0 ? (
          <div className="py-8 text-center">
            <svg
              className="mx-auto h-8 w-8 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
            <p className="mt-2 text-sm text-gray-400">
              {filter === "all" ? "No comments yet" : `No ${filter} comments`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredComments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onResolve={onResolve}
                onReply={onReply}
                isSelected={selectedCommentId === comment.id}
                onClick={() => onSelectComment(comment.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
