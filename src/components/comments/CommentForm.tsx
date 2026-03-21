"use client";

import { useState, useEffect, useRef } from "react";

interface CommentFormProps {
  position: { x: number; y: number };
  onSubmit: (content: string, authorName: string) => void;
  onCancel: () => void;
}

export default function CommentForm({ position, onSubmit, onCancel }: CommentFormProps) {
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedName = localStorage.getItem("designforge-author-name");
    if (savedName) setAuthorName(savedName);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !authorName.trim()) return;
    localStorage.setItem("designforge-author-name", authorName.trim());
    onSubmit(content.trim(), authorName.trim());
  };

  const offsetX = position.x > 70 ? -280 : 20;
  const offsetY = position.y > 70 ? -200 : 20;

  return (
    <div
      ref={formRef}
      className="absolute z-30 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        marginLeft: `${offsetX}px`,
        marginTop: `${offsetY}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Your name"
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Leave a comment..."
            rows={3}
            required
            className="block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!content.trim() || !authorName.trim()}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            Comment
          </button>
        </div>
      </form>
    </div>
  );
}
