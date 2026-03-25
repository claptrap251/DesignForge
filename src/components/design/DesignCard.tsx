"use client";

import Link from "next/link";
import { useState } from "react";
import { apiUrl } from "@/lib/basePath";

interface DesignCardProps {
  design: {
    id: string;
    name: string;
    type: string;
    status?: string;
    filePath?: string | null;
    comments?: any[];
    _count?: { comments: number };
    createdAt: Date | string;
  };
  projectId: string;
  shareToken?: string;
  onDelete?: (designId: string) => void;
  onMove?: (designId: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (designId: string) => void;
}

export default function DesignCard({
  design,
  projectId,
  shareToken,
  onDelete,
  onMove,
  selectionMode,
  selected,
  onToggleSelect,
}: DesignCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isImage = design.type === "image";
  const commentCount = design._count?.comments ?? design.comments?.length ?? 0;
  const statusConfig: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: "Draft", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" },
    IN_REVIEW: { label: "In Review", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    APPROVED: { label: "Approved", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  };
  const status = statusConfig[design.status || "DRAFT"] || statusConfig.DRAFT;
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
      setMenuOpen(false);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/designs/${design.id}`), { method: "DELETE" });
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

  const cardContent = (
    <>
      <div className="flex h-40 items-center justify-center bg-gray-50 dark:bg-gray-700">
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
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-indigo-600">
            {design.name}
          </h3>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}>
            {status.label}
          </span>
        </div>
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

      {/* Selection checkbox overlay */}
      {selectionMode && (
        <div className="absolute left-2 top-2">
          <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
            selected
              ? "border-indigo-500 bg-indigo-500 text-white"
              : "border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-700"
          }`}>
            {selected && (
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation overlay (shown after kebab menu "Delete" is clicked) */}
      {!shareToken && onDelete && confirming && (
        <div className="absolute right-2 top-2">
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "..." : "Confirm"}
            </button>
            <button
              onClick={cancelDelete}
              className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kebab menu - only in normal authenticated mode with actions available */}
      {!shareToken && !selectionMode && (onDelete || onMove) && !confirming && (
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="rounded-md bg-white/90 p-1.5 text-gray-500 shadow-sm backdrop-blur-sm hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800/90 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
            title="More actions"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>

          {menuOpen && (
            <>
              {/* Backdrop to close menu on outside click */}
              <div
                className="fixed inset-0 z-10"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              {/* Dropdown menu */}
              <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-600 dark:bg-gray-800">
                {onMove && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuOpen(false);
                      onMove(design.id);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    Move to...
                  </button>
                )}
                {onMove && onDelete && (
                  <div className="border-t border-gray-100 dark:border-gray-700" />
                )}
                {onDelete && (
                  <button
                    onClick={handleDelete}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );

  const baseCardClasses = `group relative block overflow-hidden rounded-lg border bg-white dark:bg-gray-800 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`;

  if (selectionMode) {
    return (
      <div
        onClick={() => onToggleSelect?.(design.id)}
        className={`${baseCardClasses} cursor-pointer ${
          selected
            ? "border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/30"
            : "border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
        }`}
      >
        {cardContent}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={`${baseCardClasses} border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md`}
    >
      {cardContent}
    </Link>
  );
}
