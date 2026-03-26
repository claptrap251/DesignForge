"use client";

import { useState } from "react";
import CommentThread from "./CommentThread";

export type SidebarTab = "comments" | "related";

interface CommentSidebarProps {
  comments: any[];
  onResolve: (id: string) => void;
  onReply: (commentId: string, content: string, authorName: string, authorId?: string) => void;
  onDelete?: (id: string) => void;
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
  onScrollToComment?: (commentId: string) => void;
  activeTab?: SidebarTab;
  onTabChange?: (tab: SidebarTab) => void;
  relatedContent?: React.ReactNode;
}

type FilterType = "all" | "unresolved" | "resolved";

export default function CommentSidebar({
  comments,
  onResolve,
  onReply,
  onDelete,
  selectedCommentId,
  onSelectComment,
  mobileOpen,
  onMobileClose,
  sessionUser,
  onScrollToComment,
  activeTab = "comments",
  onTabChange,
  relatedContent,
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

  const showTabs = !!relatedContent;

  const commentsContent = (
    <>
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comments</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
              {unresolvedCount} open
            </span>
            {onMobileClose && !showTabs && (
              <button
                onClick={onMobileClose}
                className="lg:hidden rounded p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="mt-2 flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5">
          {(["all", "unresolved", "resolved"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
                onDelete={onDelete}
                isSelected={selectedCommentId === comment.id}
                onClick={() => {
                  const newId = selectedCommentId === comment.id ? null : comment.id;
                  onSelectComment(newId);
                  if (newId && onScrollToComment) {
                    onScrollToComment(newId);
                  }
                }}
                sessionUser={sessionUser}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );

  const relatedTab = (
    <>
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Related Designs</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Documents with similar content in this project
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {relatedContent}
      </div>
    </>
  );

  const sidebarInner = (
    <>
      {showTabs && (
        <div className="shrink-0 flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => onTabChange?.("comments")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "comments"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Comments
            {unresolvedCount > 0 && (
              <span className="ml-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-xs text-indigo-700 dark:text-indigo-300">
                {unresolvedCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onTabChange?.("related")}
            className={`flex-1 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "related"
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Related
          </button>
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="lg:hidden px-3 py-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      {activeTab === "comments" ? commentsContent : relatedTab}
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex h-full w-80 flex-col border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        {sidebarInner}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="absolute right-0 top-0 z-10 flex h-full w-full sm:w-80 flex-col bg-gray-50 dark:bg-gray-800 shadow-xl">
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
