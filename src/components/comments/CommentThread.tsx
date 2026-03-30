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
      className="cursor-pointer rounded-lg border p-3 transition-colors"
      style={
        comment.discarded
          ? { borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)', opacity: 0.6 }
          : isSelected
            ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }
            : { borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }
      }
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: comment.discarded ? 'var(--text-tertiary)' : comment.resolved ? 'var(--success)' : 'var(--accent)' }}
          >
            {comment.pinNumber}
          </span>
          <div>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {comment.authorName || "Anonymous"}
            </span>
            <span className="ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {formatDate(comment.createdAt)}
            </span>
          </div>
        </div>

        {comment.discarded ? (
          <span className="shrink-0 rounded-md px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-tertiary)' }}>
            Discarded
          </span>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onResolve(comment.id);
            }}
            className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              comment.resolved
                ? "bg-green-50 text-green-700 hover:bg-green-100"
                : ""
            }`}
            style={!comment.resolved ? { backgroundColor: 'var(--bg-code)', color: 'var(--text-secondary)' } : undefined}
            title={comment.resolved ? "Unresolve" : "Resolve"}
          >
          {comment.resolved ? "Resolved" : "Resolve"}
        </button>
        )}
      </div>

      <p className={`mt-2 text-sm ${comment.discarded ? "line-through" : ""}`} style={{ color: comment.discarded ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>{comment.content}</p>

      {comment.anchorText && (
        <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.03a4.5 4.5 0 00-6.364-6.364L4.757 8.25a4.5 4.5 0 003.182 7.431" />
          </svg>
          <span className="truncate max-w-[180px]">&quot;{comment.anchorText}&quot;</span>
        </div>
      )}

      {comment.anchorLine != null && (
        <div className="mt-1 flex items-center gap-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
          <span>Line {comment.anchorLine}</span>
          {comment.anchorHeading && (
            <span style={{ color: 'var(--border-medium)' }}>{comment.anchorHeading}</span>
          )}
        </div>
      )}

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-3 space-y-2 border-l-2 pl-3" style={{ borderColor: 'var(--border-subtle)' }}>
          {comment.replies.map((reply: any) => (
            <div key={reply.id}>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {reply.authorName || "Anonymous"}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {formatDate(reply.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>{reply.content}</p>
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
                className="block w-full rounded-md border px-2.5 py-1.5 text-xs shadow-sm placeholder:text-gray-400 focus:outline-none"
                style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
              />
            )}
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Write a reply..."
              rows={2}
              required
              className="block w-full rounded-md border px-2.5 py-1.5 text-xs shadow-sm placeholder:text-gray-400 focus:outline-none"
              style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
              autoFocus
            />
            <div className="flex justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyContent("");
                }}
                className="rounded-md border px-2 py-1 text-xs font-medium"
                style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!replyContent.trim() || (!sessionUser && !replyAuthor.trim())}
                className="rounded-md px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
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
              className="text-xs font-medium"
              style={{ color: 'var(--accent)' }}
            >
              Reply
            </button>
            {onDelete && sessionUser && (
              confirmDelete ? (
                <span className="inline-flex items-center gap-1.5 ml-3" onClick={(e) => e.stopPropagation()}>
                  <span className="text-xs text-red-600">Delete this comment?</span>
                  <button
                    onClick={() => { onDelete(comment.id); setConfirmDelete(false); }}
                    className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-md border px-2 py-0.5 text-xs font-medium"
                    style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  className="ml-3 text-xs font-medium text-red-500 hover:text-red-700"
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
