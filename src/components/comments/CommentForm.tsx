"use client";

import { useState, useEffect, useRef } from "react";

interface CommentFormProps {
  position?: { x: number; y: number };
  onSubmit: (content: string, authorName: string, authorId?: string) => void;
  onCancel: () => void;
  sessionUser?: { id: string; name?: string; username?: string };
}

export default function CommentForm({ position, onSubmit, onCancel, sessionUser }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionUser) {
      const savedName = localStorage.getItem("designforge-author-name");
      if (savedName) setAuthorName(savedName);
    }
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, [sessionUser]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = sessionUser
      ? (sessionUser.name || sessionUser.username || "Unknown")
      : authorName.trim();
    if (!content.trim() || !name) return;
    if (!sessionUser) {
      localStorage.setItem("designforge-author-name", name);
    }
    onSubmit(content.trim(), name, sessionUser?.id);
  };

  const offsetX = position ? (position.x > 70 ? -280 : 20) : 0;
  const offsetY = position ? (position.y > 70 ? -200 : 20) : 0;

  return (
    <div
      ref={formRef}
      className={`${position ? 'absolute z-30' : ''} w-72 rounded-lg border p-4 shadow-xl`}
      style={{
        borderColor: 'var(--border-subtle)',
        backgroundColor: 'var(--bg-page)',
        ...(position ? {
          left: `${position.x}%`,
          top: `${position.y}%`,
          marginLeft: `${offsetX}px`,
          marginTop: `${offsetY}px`,
        } : {}),
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {!sessionUser && (
          <div>
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name"
              required
              className="block w-full rounded-lg border px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none"
              style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
            />
          </div>
        )}
        <div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Leave a comment..."
            rows={3}
            required
            className="block w-full rounded-lg border px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none"
            style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || (!sessionUser && !authorName.trim())}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
