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
  const isUserRoot = !!(folder as any).ownerUsername && !(folder as any).parentId;
  const isDisabled = isCurrent || isUserRoot;
  const isSelected = folder.id === selectedId;
  const hasChildren = folder.children && folder.children.length > 0;

  return (
    <div>
      <button
        onClick={() => !isDisabled && onSelect(folder.id)}
        disabled={isDisabled}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left transition-colors ${
          isDisabled
            ? "cursor-not-allowed"
            : isSelected
            ? "font-medium"
            : "cursor-pointer"
        }`}
        style={{
          paddingLeft: `${level * 20 + 8}px`,
          ...(isDisabled
            ? { color: 'var(--text-tertiary)' }
            : isSelected
            ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }
            : { color: 'var(--text-secondary)' }),
        }}
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
          className="h-4 w-4 shrink-0"
          style={{ color: isSelected ? 'var(--accent)' : 'var(--text-tertiary)' }}
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
          {isCurrent && <span className="ml-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>(current)</span>}
        </span>
        {isSelected && (
          <svg className="ml-auto h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
      <div className="relative z-10 w-full max-w-sm rounded-xl border p-5 shadow-xl" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
        <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Select a destination folder</p>

        <div className="max-h-64 overflow-y-auto rounded-lg border p-1" style={{ borderColor: 'var(--border-subtle)' }}>
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
            className="rounded-lg border px-3 py-1.5 text-sm font-medium"
            style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedId}
            className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
