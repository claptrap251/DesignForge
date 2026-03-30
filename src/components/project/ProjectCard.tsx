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
  const [hovered, setHovered] = useState(false);

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
      className="group relative block focus:outline-none focus:ring-2 focus:ring-offset-2"
      style={{
        backgroundColor: 'var(--bg-page)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '4px',
        padding: '1.25rem',
        transition: 'box-shadow 0.15s ease',
        boxShadow: hovered ? 'rgba(15,15,15,0.1) 0 0 0 1px, rgba(15,15,15,0.1) 0 2px 4px' : 'none',
        display: 'block',
        textDecoration: 'none',
      }}
      onMouseOver={() => setHovered(true)}
      onMouseOut={() => setHovered(false)}
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--bg-code)', color: 'var(--accent)' }}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 5a1 1 0 011-1h4l2 2h6a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
            />
          </svg>
        </div>
      </div>

      <h3
        className="mt-3 text-base"
        style={{ color: 'var(--text-primary)', fontWeight: 600 }}
      >
        {project.name}
      </h3>

      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {project.description}
        </p>
      )}

      {project.owner?.username && (
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Created by {project.owner.username}
        </p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
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
                className="rounded-md px-2 py-1 text-xs font-medium shadow-sm"
                style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDelete}
              className="rounded-md p-1.5 shadow-sm backdrop-blur-sm hover:bg-red-50 hover:text-red-600"
              style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-tertiary)' }}
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
