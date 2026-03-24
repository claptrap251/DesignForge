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
        className="flex items-center gap-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
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
        <span className="text-gray-400">({versions.length} versions)</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          <div className="border-b border-gray-100 dark:border-gray-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Version History</h3>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {versions.map((version) => (
              <button
                key={version.id}
                onClick={() => {
                  onViewVersion(version);
                  setIsOpen(false);
                }}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  version.version === currentVersion
                    ? "bg-indigo-50 dark:bg-indigo-900/30"
                    : ""
                }`}
              >
                <div className="flex-shrink-0 pt-0.5">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      version.version === currentVersion
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                    }`}
                  >
                    {version.version}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Version {version.version}
                    </span>
                    {version.version === currentVersion && (
                      <span className="rounded bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                        Current
                      </span>
                    )}
                  </div>
                  {version.changeNote && (
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 truncate">
                      {version.changeNote}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(version.createdAt)}
                  </p>
                  {version.version !== currentVersion && onCreateFromVersion && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateFromVersion(version);
                        setIsOpen(false);
                      }}
                      className="mt-1 rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-900/50 dark:hover:text-indigo-300 transition"
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
