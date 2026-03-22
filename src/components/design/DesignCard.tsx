"use client";

import Link from "next/link";
import { useState } from "react";

interface DesignCardProps {
  design: {
    id: string;
    name: string;
    type: string;
    filePath?: string | null;
    comments: any[];
    createdAt: Date | string;
  };
  projectId: string;
  shareToken?: string;
  onDelete?: (designId: string) => void;
}

export default function DesignCard({ design, projectId, shareToken, onDelete }: DesignCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isImage = design.type === "image";
  const commentCount = design.comments?.length ?? 0;
  const createdDate = new Date(design.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const href = shareToken
    ? `/share/${shareToken}/design/${design.id}`
    : `/project/${projectId}/design/${design.id}`;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirming) {
      setConfirming(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/designs/${design.id}`, { method: "DELETE" });
      if (res.ok) {
        onDelete?.(design.id);
      }
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirming(false);
  };

  return (
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all hover:border-indigo-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <div className="flex h-40 items-center justify-center bg-gray-50">
        {isImage && design.filePath ? (
          <img
            src={design.filePath}
            alt={design.name}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
              />
            </svg>
            <span className="text-xs font-medium">Markdown</span>
          </div>
        )}
      </div>

      <div className="p-3">
        <h3 className="truncate text-sm font-medium text-gray-900 group-hover:text-indigo-600">
          {design.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
              />
            </svg>
            {commentCount}
          </span>
          <span>{createdDate}</span>
        </div>
      </div>

      {/* Delete button - only for authenticated views */}
      {!shareToken && onDelete && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          {confirming ? (
            <div className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "..." : "Delete"}
              </button>
              <button
                onClick={cancelDelete}
                className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-md bg-white/90 p-1.5 text-gray-400 shadow-sm backdrop-blur-sm hover:bg-red-50 hover:text-red-600"
              title="Delete design"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      )}
    </Link>
  );
}
