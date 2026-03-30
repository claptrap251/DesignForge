"use client";

import { useState } from "react";

interface SidebarProps {
  folders: any[];
  activeFolder: string | null;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  projectName: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  currentUsername?: string;
  isAdmin?: boolean;
}

function FolderItem({
  folder,
  level,
  activeFolder,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  onRenameFolder,
  currentUsername,
  isAdmin,
  inheritedOwner,
}: {
  folder: any;
  level: number;
  activeFolder: string | null;
  onSelectFolder: (id: string) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onDeleteFolder: (id: string) => void;
  onRenameFolder: (id: string, newName: string) => void;
  currentUsername?: string;
  isAdmin?: boolean;
  inheritedOwner?: string | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isActive = activeFolder === folder.id;
  const hasChildren = folder.children && folder.children.length > 0;
  const folderOwner = folder.ownerUsername || inheritedOwner || null;
  const isOwnFolder = folderOwner === currentUsername;

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

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
        className={`group flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-sm cursor-pointer transition-colors ${
          isActive
            ? "font-medium"
            : "hover-warm"
        }`}
        style={{
          paddingLeft: `${level * 16 + 8}px`,
          ...(isActive
            ? { backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }
            : { color: "var(--text-secondary)" }),
        }}
        onClick={() => onSelectFolder(folder.id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px]"
          style={{ color: "var(--text-tertiary)" }}
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
          className="h-4 w-4 shrink-0"
          style={{ color: isActive ? "var(--text-primary)" : "var(--text-tertiary)" }}
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

        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") {
                setRenameValue(folder.name);
                setIsRenaming(false);
              }
            }}
            onBlur={handleRename}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-[6px] px-2 py-0.5 text-sm focus:outline-none focus:ring-1"
            style={{
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-hover)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
        ) : (
          <>
            <span
              className="truncate flex-1"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setRenameValue(folder.name);
                setIsRenaming(true);
              }}
            >
              {folder.name}
            </span>
            {!isOwnFolder && folderOwner && (
              <span className="ml-1 text-[10px] shrink-0" style={{ color: "var(--text-tertiary)" }} title="Read-only">
                <svg className="h-3 w-3 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </span>
            )}
          </>
        )}

        <div className="flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
          {isOwnFolder && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setRenameValue(folder.name);
                  setIsRenaming(true);
                }}
                className="rounded-[6px] p-0.5 hover-warm"
                style={{ color: "var(--text-tertiary)" }}
                title="Rename folder"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNewFolder(true);
                }}
                className="rounded-[6px] p-0.5 hover-warm"
                style={{ color: "var(--text-tertiary)" }}
                title="Add subfolder"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </>
          )}
          {(isOwnFolder || isAdmin) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmingDelete(true);
                }}
                className="rounded-[6px] p-0.5 hover:bg-red-50 hover:text-red-600"
                style={{ color: "var(--text-tertiary)" }}
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
          )}
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
            className="w-full rounded-[6px] px-2 py-1 text-sm focus:outline-none focus:ring-1"
            style={{
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-hover)",
              color: "var(--text-primary)",
            }}
            autoFocus
          />
          <button
            onClick={handleCreateSubfolder}
            className="rounded-[6px] p-1 text-white"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
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
            className="rounded-[6px] p-1 hover-warm"
            style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
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
              onRenameFolder={onRenameFolder}
              currentUsername={currentUsername}
              isAdmin={isAdmin}
              inheritedOwner={folderOwner}
            />
          ))}
        </div>
      )}

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
          <div className="fixed inset-0 bg-black/50" onClick={() => setConfirmingDelete(false)} />
          <div
            className="relative z-10 w-full max-w-xs rounded-xl p-5 shadow-xl"
            style={{
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-sidebar)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Delete folder</h3>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                  &quot;{folder.name}&quot; and all its contents will be permanently deleted.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-[6px] px-3 py-1.5 text-sm font-medium hover-warm"
                style={{
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmingDelete(false);
                  onDeleteFolder(folder.id);
                }}
                className="rounded-[6px] bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
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
  onRenameFolder,
  projectName,
  mobileOpen,
  onMobileClose,
  currentUsername,
  isAdmin,
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

  const handleSelectFolder = (id: string) => {
    onSelectFolder(id);
    onMobileClose?.();
  };

  const sidebarInner = (
    <>
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <h2 className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{projectName}</h2>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="lg:hidden rounded-[6px] p-1 hover-warm"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <div className="mb-2 flex items-center justify-between px-2">
          <span
            className="text-[11px] font-medium uppercase tracking-wide"
            style={{ color: "var(--text-tertiary)" }}
          >
            Folders
          </span>
          {isAdmin && (
            <button
              onClick={() => setShowNewFolder(true)}
              className="rounded-[6px] p-1 hover-warm"
              style={{ color: "var(--text-tertiary)" }}
              title="New folder"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
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
              className="w-full rounded-[6px] px-2 py-1 text-sm focus:outline-none focus:ring-1"
              style={{
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-hover)",
                color: "var(--text-primary)",
              }}
              autoFocus
            />
            <button
              onClick={handleCreateRootFolder}
              className="rounded-[6px] p-1"
              style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-primary)" }}
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
              className="rounded-[6px] p-1 hover-warm"
              style={{ backgroundColor: "var(--bg-hover)", color: "var(--text-secondary)" }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {folders.length === 0 && !showNewFolder && (
          <p className="px-2 py-4 text-center text-sm" style={{ color: "var(--text-tertiary)" }}>
            No folders yet. Create one to get started.
          </p>
        )}

        {folders.map((folder) => (
          <FolderItem
            key={folder.id}
            folder={folder}
            level={0}
            activeFolder={activeFolder}
            onSelectFolder={handleSelectFolder}
            onCreateFolder={onCreateFolder}
            onDeleteFolder={onDeleteFolder}
            onRenameFolder={onRenameFolder}
            currentUsername={currentUsername}
            isAdmin={isAdmin}
          />
        ))}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex h-full w-64 flex-col"
        style={{ backgroundColor: "var(--bg-sidebar)" }}
      >
        {sidebarInner}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="fixed inset-0 bg-black/50" onClick={onMobileClose} />
          <aside
            className="relative z-10 flex h-full w-72 flex-col shadow-xl"
            style={{ backgroundColor: "var(--bg-sidebar)" }}
          >
            {sidebarInner}
          </aside>
        </div>
      )}
    </>
  );
}
