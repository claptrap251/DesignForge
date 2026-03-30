"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import DesignCard from "@/components/design/DesignCard";
import DesignGrid from "@/components/design/DesignGrid";
import DesignUpload from "@/components/design/DesignUpload";
import ShareDialog from "@/components/share/ShareDialog";
import FolderPickerModal from "@/components/design/FolderPickerModal";

export default function ProjectPage() {
  const { data: session } = useSession();
  const params = useParams();
  const projectId = params.projectId as string;

  const searchParams = useSearchParams();
  const currentUsername = (session?.user as any)?.username as string | undefined;

  const [project, setProject] = useState<any>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(searchParams.get("folder"));
  const [showUpload, setShowUpload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDesigns, setSelectedDesigns] = useState<Set<string>>(new Set());
  const [moveTarget, setMoveTarget] = useState<string | null>(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);

  const fetchProject = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/projects/${projectId}`));
    if (res.ok) {
      const data = await res.json();
      setProject(data);
      if (!activeFolder && data.folders.length > 0) {
        setActiveFolder(data.folders[0].id);
      }
    }
    setLoading(false);
  }, [projectId, activeFolder]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const creatingUserFolder = useRef(false);
  useEffect(() => {
    if (!project || !currentUsername || creatingUserFolder.current) return;
    const hasUserFolder = project.folders.some(
      (f: any) => f.ownerUsername === currentUsername && !f.parentId
    );
    if (!hasUserFolder) {
      creatingUserFolder.current = true;
      fetch(apiUrl("/api/folders"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: currentUsername,
          projectId,
          ownerUsername: currentUsername,
        }),
      }).then(() => {
        creatingUserFolder.current = false;
        fetchProject();
      }).catch(() => {
        creatingUserFolder.current = false;
      });
    }
  }, [project, currentUsername, projectId, fetchProject]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/check"))
      .then((r) => r.json())
      .then((d) => setIsAdminUser(d.isAdmin))
      .catch(() => {});
  }, []);

  const handleCreateFolder = async (name: string, parentId?: string) => {
    await fetch(apiUrl("/api/folders"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, projectId, parentId }),
    });
    fetchProject();
  };

  const handleDeleteFolder = async (id: string) => {
    await fetch(apiUrl(`/api/folders/${id}`), { method: "DELETE" });
    if (activeFolder === id) setActiveFolder(null);
    fetchProject();
  };

  const handleRenameFolder = async (id: string, newName: string) => {
    await fetch(apiUrl(`/api/folders/${id}`), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    fetchProject();
  };

  const handleToggleSelect = (designId: string) => {
    setSelectedDesigns((prev) => {
      const next = new Set(prev);
      if (next.has(designId)) next.delete(designId);
      else next.add(designId);
      return next;
    });
  };

  const handleMoveDesign = (designId: string) => {
    setMoveTarget(designId);
    setShowFolderPicker(true);
  };

  const handleBulkMove = () => {
    setBulkMoving(true);
    setShowFolderPicker(true);
  };

  const handleFolderPickerSelect = async (folderId: string) => {
    setShowFolderPicker(false);
    if (bulkMoving) {
      await fetch(apiUrl("/api/designs/move"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designIds: Array.from(selectedDesigns), folderId }),
      });
      setSelectionMode(false);
      setSelectedDesigns(new Set());
      setBulkMoving(false);
    } else if (moveTarget) {
      await fetch(apiUrl(`/api/designs/${moveTarget}/move`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      setMoveTarget(null);
    }
    fetchProject();
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedDesigns(new Set());
  };

  const findFolder = (folders: any[], id: string): any => {
    for (const f of folders) {
      if (f.id === id) return f;
      if (f.children?.length) {
        const found = findFolder(f.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const activeFolderData = activeFolder
    ? findFolder(project?.folders || [], activeFolder)
    : null;

  const isReadOnly = (() => {
    if (!activeFolderData || !currentUsername) return true;
    const findOwner = (folder: any): string | null => {
      if (folder.ownerUsername) return folder.ownerUsername;
      if (folder.parentId && project?.folders) {
        const findInTree = (folders: any[], id: string): any => {
          for (const f of folders) {
            if (f.id === id) return f;
            if (f.children) {
              const found = findInTree(f.children, id);
              if (found) return found;
            }
          }
          return null;
        };
        const parent = findInTree(project.folders, folder.parentId);
        if (parent) return findOwner(parent);
      }
      return null;
    };
    const owner = findOwner(activeFolderData);
    return owner !== currentUsername;
  })();

  const sortedFolders = [...(project?.folders || [])].sort((a: any, b: any) => {
    if (a.ownerUsername === currentUsername) return -1;
    if (b.ownerUsername === currentUsername) return 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header session={session} isAdmin={isAdminUser} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header session={session} isAdmin={isAdminUser} />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 dark:text-gray-400">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header session={session} isAdmin={isAdminUser} />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          folders={sortedFolders}
          activeFolder={activeFolder}
          onSelectFolder={setActiveFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          onRenameFolder={handleRenameFolder}
          projectName={project.name}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
          currentUsername={currentUsername}
          isAdmin={isAdminUser}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              {/* Mobile sidebar toggle */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden rounded-lg border border-gray-300 dark:border-gray-600 p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                aria-label="Open folders"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </button>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                  {activeFolderData?.name || "Select a folder"}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeFolderData?.designs?.length || 0} designs
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!isReadOnly && activeFolder && activeFolderData?.designs?.length > 0 && (
                <button
                  onClick={() => selectionMode ? cancelSelection() : setSelectionMode(true)}
                  className={`px-3 py-2 text-sm border rounded-lg transition flex items-center gap-1 ${
                    selectionMode
                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="hidden sm:inline">{selectionMode ? "Cancel" : "Select"}</span>
                </button>
              )}
              <button
                onClick={() => setShowShare(true)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              {!isReadOnly && activeFolder && !(activeFolderData?.ownerUsername && !activeFolderData?.parentId) && (
                <button
                  onClick={() => setShowUpload(true)}
                  className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">Upload</span>
                </button>
              )}
            </div>
          </div>

          {activeFolder && activeFolderData ? (
            // User-root folder: show capability folders as cards
            activeFolderData.ownerUsername && !activeFolderData.parentId ? (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {activeFolderData.children?.length || 0} capability folders
                  </p>
                </div>
                {activeFolderData.children?.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {activeFolderData.children.map((child: any) => {
                      const designCount = child.designs?.length || 0;
                      const childFolderCount = child.children?.length || 0;
                      return (
                        <button
                          key={child.id}
                          onClick={() => setActiveFolder(child.id)}
                          className="group text-left block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md"
                        >
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </div>
                          <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600">
                            {child.name}
                          </h3>
                          <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                            <span className="flex items-center gap-1">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                              {designCount} {designCount === 1 ? "design" : "designs"}
                            </span>
                            {childFolderCount > 0 && (
                              <span className="flex items-center gap-1">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                                {childFolderCount} {childFolderCount === 1 ? "folder" : "folders"}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 py-16">
                    <svg className="h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <p className="mt-3 text-sm font-medium text-gray-600 dark:text-gray-300">No capability folders yet</p>
                    <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Create a sub-folder to start adding designs</p>
                  </div>
                )}
              </div>
            ) : (
            (() => {
              const allDesigns = activeFolderData.designs || [];
              const filtered = statusFilter
                ? allDesigns.filter((d: any) => (d.status || "DRAFT") === statusFilter)
                : allDesigns;
              const sections = [
                { key: "DRAFT", label: "Draft", color: "text-gray-500 dark:text-gray-400", dot: "bg-gray-400" },
                { key: "IN_REVIEW", label: "In Review", color: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
                { key: "APPROVED", label: "Approved", color: "text-green-600 dark:text-green-400", dot: "bg-green-500" },
              ];
              const grouped = sections.map((s) => ({
                ...s,
                designs: filtered.filter((d: any) => (d.status || "DRAFT") === s.key),
              }));

              return (
                <div>
                  {/* Selection toolbar */}
                  {selectionMode && selectedDesigns.size > 0 && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-4 py-2">
                      <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                        {selectedDesigns.size} selected
                      </span>
                      <button
                        onClick={handleBulkMove}
                        className="rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Move selected
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={cancelSelection}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Status filter */}
                  <div className="mb-4 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Filter:</span>
                    <button
                      onClick={() => setStatusFilter(null)}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                        statusFilter === null
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      }`}
                    >
                      All ({allDesigns.length})
                    </button>
                    {sections.map((s) => {
                      const count = allDesigns.filter((d: any) => (d.status || "DRAFT") === s.key).length;
                      return (
                        <button
                          key={s.key}
                          onClick={() => setStatusFilter(statusFilter === s.key ? null : s.key)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                            statusFilter === s.key
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                          }`}
                        >
                          {s.label} ({count})
                        </button>
                      );
                    })}
                  </div>

                  {/* Grouped sections */}
                  {grouped.map((section) =>
                    section.designs.length > 0 ? (
                      <div key={section.key} className="mb-8">
                        <div className="mb-3 flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${section.dot}`} />
                          <h3 className={`text-sm font-semibold uppercase tracking-wider ${section.color}`}>
                            {section.label}
                          </h3>
                          <span className="text-xs text-gray-400">({section.designs.length})</span>
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {section.designs.map((design: any) => (
                            <DesignCard
                              key={design.id}
                              design={design}
                              projectId={projectId}
                              onDelete={isReadOnly ? undefined : () => fetchProject()}
                              onMove={isReadOnly ? undefined : handleMoveDesign}
                              selectionMode={isReadOnly ? false : selectionMode}
                              selected={selectedDesigns.has(design.id)}
                              onToggleSelect={isReadOnly ? undefined : handleToggleSelect}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}

                  {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 py-16">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {statusFilter ? `No ${sections.find((s) => s.key === statusFilter)?.label.toLowerCase()} designs` : "No designs yet"}
                      </p>
                      <button
                        onClick={() => setShowUpload(true)}
                        className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                      >
                        Upload Design
                      </button>
                    </div>
                  )}
                </div>
              );
            })()
            )
          ) : (
            <div className="text-center py-20 text-gray-500 dark:text-gray-400">
              Select a folder or create one to get started
            </div>
          )}
        </main>
      </div>

      {showUpload && activeFolder && (
        <DesignUpload
          folderId={activeFolder}
          onUploadComplete={() => {
            setShowUpload(false);
            fetchProject();
          }}
          onClose={() => setShowUpload(false)}
        />
      )}
      <ShareDialog
        projectId={projectId}
        open={showShare}
        onClose={() => setShowShare(false)}
      />
      {showFolderPicker && activeFolder && (
        <FolderPickerModal
          folders={project.folders}
          currentFolderId={activeFolder}
          onSelect={handleFolderPickerSelect}
          onClose={() => {
            setShowFolderPicker(false);
            setMoveTarget(null);
            setBulkMoving(false);
          }}
          title={bulkMoving ? `Move ${selectedDesigns.size} designs to...` : "Move design to..."}
        />
      )}
    </div>
  );
}
