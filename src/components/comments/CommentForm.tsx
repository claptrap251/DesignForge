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
      className={`${position ? 'absolute z-30' : ''} w-72 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-xl`}
      style={position ? {
        left: `${position.x}%`,
        top: `${position.y}%`,
        marginLeft: `${offsetX}px`,
        marginTop: `${offsetY}px`,
      } : undefined}
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
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
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
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || (!sessionUser && !authorName.trim())}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
