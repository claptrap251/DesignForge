"use client";

import { useState, useEffect } from "react";

interface CommentThreadProps {
  comment: any;
  onResolve: (id: string) => void;
  onReply: (commentId: string, content: string, authorName: string, authorId?: string) => void;
  onDelete?: (id: string) => void;
  isSelected: boolean;
  onClick: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}

export default function CommentThread({
  comment,
  onResolve,
  onReply,
  onDelete,
  isSelected,
  onClick,
  sessionUser,
}: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replyAuthor, setReplyAuthor] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!sessionUser) {
      const savedName = localStorage.getItem("designforge-author-name");
      if (savedName) setReplyAuthor(savedName);
    }
  }, [sessionUser]);

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = sessionUser
      ? (sessionUser.name || sessionUser.username || "Unknown")
      : replyAuthor.trim();
    if (!replyContent.trim() || !name) return;
    if (!sessionUser) {
      localStorage.setItem("designforge-author-name", name);
    }
    onReply(comment.id, replyContent.trim(), name, sessionUser?.id);
    setReplyContent("");
    setShowReplyForm(false);
  };

  const formatDate = (dateStr: string | Date) =>
    new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div
      className={`cursor-pointer rounded-lg border p-3 transition-colors ${
        isSelected
          ? "border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30"
          : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
              comment.resolved ? "bg-green-500" : "bg-indigo-600"
            }`}
          >
            {comment.pinNumber}
          </span>
          <div>
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {comment.authorName || "Anonymous"}
            </span>
            <span className="ml-2 text-xs text-gray-400">
              {formatDate(comment.createdAt)}
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onResolve(comment.id);
          }}
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            comment.resolved
              ? "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
          title={comment.resolved ? "Unresolve" : "Resolve"}
        >
          {comment.resolved ? "Resolved" : "Resolve"}
        </button>
      </div>

      <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">{comment.content}</p>

      {comment.anchorLine != null && (
        <div className="mt-1 flex items-center gap-1 text-xs text-gray-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <span>Line {comment.anchorLine}</span>
          {comment.anchorHeading && (
            <span className="text-gray-300">· {comment.anchorHeading}</span>
          )}
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 border-gray-200 dark:border-gray-600 pl-3">
          {comment.replies.map((reply: any) => (
            <div key={reply.id}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  {reply.authorName || "Anonymous"}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDate(reply.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-400">{reply.content}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2">
        {showReplyForm ? (
          <form
            onSubmit={handleReplySubmit}
            onClick={(e) => e.stopPropagation()}
            className="space-y-2"
          >
            {!sessionUser && (
              <input
                type="text"
                value={replyAuthor}
                onChange={(e) => setReplyAuthor(e.target.value)}
                placeholder="Your name"
                required
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              />
            )}
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              required
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 px-2.5 py-1.5 text-xs shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent("");
                }}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!replyContent.trim() || (!sessionUser && !replyAuthor.trim())}
                className="rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Reply
              </button>
            </div>
          </form>
        ) : (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowReplyForm(true);
              }}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
            >
              Reply
            </button>
            {onDelete && sessionUser && (
              confirmDelete ? (
                <span className="inline-flex items-center gap-1.5 ml-3" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-red-600 dark:text-red-400">Delete this comment?</span>
                  <button
                    onClick={() => { onDelete(comment.id); setConfirmDelete(false); }}
                    className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  className="ml-3 text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Delete
                </button>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
