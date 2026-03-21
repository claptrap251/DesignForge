"use client";

import { useState } from "react";

interface SidebarProps {
  folders: any[];
  activeFolder: string | null;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
  projectName: string;
}

function FolderItem({
  folder,
  level,
  activeFolder,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
}: {
  folder: any;
  level: number;
  activeFolder: string | null;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const isActive = activeFolder === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;

  const handleCreateSubfolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim(), folder.id);
      setNewFolderName("");
      setShowNewFolder(false);
    }
  };

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors ${
          isActive
            ? "bg-indigo-50 text-indigo-700 font-medium"
            : "text-gray-700 hover:bg-gray-100"
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelectFolder(folder.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-gray-400 hover:text-gray-600"
        >
          {hasChildren ? (
            <svg
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>

        <svg
          className={`h-4 w-4 shrink-0 ${isActive ? "text-indigo-600" : "text-gray-400"}`}
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

        <span className="truncate flex-1">{folder.name}</span>

        <div className="hidden gap-0.5 group-hover:flex">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNewFolder(true);
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-600"
            title="Add subfolder"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFolder(folder.id);
            }}
            className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete folder"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {showNewFolder && (
        <div className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}>
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateSubfolder();
              if (e.key === "Escape") {
                setShowNewFolder(false);
                setNewFolderName("");
              }
            }}
            placeholder="Folder name"
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            autoFocus
          />
          <button
            onClick={handleCreateSubfolder}
            className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-700"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              setShowNewFolder(false);
              setNewFolderName("");
            }}
            className="rounded bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {expanded && hasChildren && (
        <div>
          {folder.children.map((child: any) => (
            <FolderItem
              key={child.id}
              folder={child}
              level={level + 1}
              activeFolder={activeFolder}
              onSelectFolder={onSelectFolder}
              onCreateFolder={onCreateFolder}
              onDeleteFolder={onDeleteFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  folders,
  activeFolder,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  projectName,
}: SidebarProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const handleCreateRootFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
    }
  };

  return (
    <aside className="flex h-full w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2 className="truncate text-sm font-semibold text-gray-900">{projectName}</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wider text-gray-500">Folders</span>
          <button
            onClick={() => setShowNewFolder(true)}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="New folder"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {showNewFolder && (
          <div className="mb-2 flex items-center gap-1 px-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateRootFolder();
                if (e.key === "Escape") {
                  setShowNewFolder(false);
                  setNewFolderName("");
                }
              }}
              placeholder="Folder name"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              onClick={handleCreateRootFolder}
              className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </button>
            <button
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
              className="rounded bg-gray-100 p-1 text-gray-600 hover:bg-gray-200"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {folders.length === 0 && !showNewFolder && (
          <p className="px-2 py-4 text-center text-sm text-gray-400">
            No folders yet. Create one to get started.
          </p>
        )}

        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            activeFolder={activeFolder}
            onSelectFolder={onSelectFolder}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
          />
        ))}
      </div>
    </aside>
  );
}
