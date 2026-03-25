"use client";

import { useState } from "react";

interface FolderNode {
  id: string;
  name: string;
  children?: FolderNode[];
}

interface FolderPickerModalProps {
  folders: FolderNode[];
  currentFolderId: string;
  onSelect: (folderId: string) => void;
  onClose: () => void;
  title: string;
}

function FolderTreeItem({
  folder,
  level,
  selectedId,
  currentFolderId,
  onSelect,
}: {
  folder: FolderNode;
  level: number;
  selectedId: string | null;
  currentFolderId: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const isCurrent = folder.id === currentFolderId;
  const isSelected = folder.id === selectedId;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <button
        onClick={() => !isCurrent && onSelect(folder.id)}
        disabled={isCurrent}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
          isCurrent
            ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
            : isSelected
            ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-medium"
            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
        }`}
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="flex h-4 w-4 shrink-0 items-center justify-center"
          >
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        ) : (
          <span className="h-4 w-4 shrink-0" />
        )}
        <svg
          className={`h-4 w-4 shrink-0 ${isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
          />
        </svg>
        <span className="truncate">
          {folder.name}
          {isCurrent && <span className="ml-1 text-xs text-gray-400">(current)</span>}
        </span>
        {isSelected && (
          <svg className="ml-auto h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedId={selectedId}
              currentFolderId={currentFolderId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FolderPickerModal({
  folders,
  currentFolderId,
  onSelect,
  onClose,
  title,
}: FolderPickerModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
          {title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Select a destination folder</p>

        <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-1">
          {folders.map((folder) => (
            <FolderTreeItem
              key={folder.id}
              folder={folder}
              level={0}
              selectedId={selectedId}
              currentFolderId={currentFolderId}
              onSelect={setSelectedId}
            />
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
