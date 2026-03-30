"use client";

import { useState } from "react";

interface Version {
  id: string;
  version: number;
  filePath: string | null;
  content: string | null;
  changeNote: string | null;
  createdAt: string;
}

interface VersionHistoryProps {
  versions: Version[];
  currentVersion: number;
  designType: string;
  onViewVersion: (version: Version) => void;
  onCreateFromVersion?: (version: Version) => void;
}

export default function VersionHistory({
  versions,
  currentVersion,
  designType,
  onViewVersion,
  onCreateFromVersion,
}: VersionHistoryProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!versions || versions.length <= 1) return null;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
        style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-secondary)' }}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        v{currentVersion}
        <span style={{ color: 'var(--text-tertiary)' }}>({versions.length} versions)</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border shadow-lg" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Version History</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => {
                  onViewVersion(version);
                  setIsOpen(false);
                }}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:opacity-80"
                style={
                  version.version === currentVersion
                    ? { backgroundColor: 'var(--accent-bg)' }
                    : undefined
                }
              >
                <div className="flex-shrink-0 pt-0.5">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold"
                    style={
                      version.version === currentVersion
                        ? { backgroundColor: 'var(--accent)', color: 'white' }
                        : { backgroundColor: 'var(--bg-code)', color: 'var(--text-tertiary)' }
                    }
                  >
                    {version.version}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Version {version.version}
                    </span>
                    {version.version === currentVersion && (
                      <span className="rounded px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
                        Current
                      </span>
                    )}
                  </div>
                  {version.changeNote && (
                    <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {version.changeNote}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {formatDate(version.createdAt)}
                  </p>
                  {version.version !== currentVersion && onCreateFromVersion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFromVersion(version);
                        setIsOpen(false);
                      }}
                      className="mt-1 rounded px-1.5 py-0.5 text-xs font-medium transition"
                      style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-secondary)' }}
                    >
                      Use as base
                    </button>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
