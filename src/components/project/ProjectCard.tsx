"use client";

import { useState } from "react";
import Link from "next/link";
import { apiUrl } from "@/lib/basePath";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    createdAt: Date | string;
    _count?: { folders: number };
    owner?: { username: string } | null;
  };
  isAdmin?: boolean;
  onDelete?: () => void;
}

export default function ProjectCard({ project, isAdmin, onDelete }: ProjectCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const createdDate = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const folderCount = project._count?.folders ?? 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(apiUrl(`/api/projects/${project.id}`), { method: "DELETE" });
      if (res.ok) onDelete?.();
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
      href={`/project/${project.id}`}
      className="group relative block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 5a1 1 0 011-1h4l2 2h6a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
            />
          </svg>
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600">
        {project.name}
      </h3>

      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
      )}

      {project.owner?.username && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          Created by {project.owner.username}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          {folderCount} {folderCount === 1 ? "folder" : "folders"}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {createdDate}
        </span>
      </div>

      {isAdmin && onDelete && (
        <div className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100">
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
                className="rounded-md bg-white dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-md bg-white/90 dark:bg-gray-800/90 p-1.5 text-gray-400 shadow-sm backdrop-blur-sm hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600"
              title="Delete project"
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
