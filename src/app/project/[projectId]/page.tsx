"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import DesignCard from "@/components/design/DesignCard";
import DesignGrid from "@/components/design/DesignGrid";
import DesignUpload from "@/components/design/DesignUpload";
import ShareDialog from "@/components/share/ShareDialog";

export default function ProjectPage() {
  const { data: session } = useSession();
  const params = useParams();
  const projectId = params.projectId as string;

  const [project, setProject] = useState<any>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500 dark:text-gray-400">Project not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <Header session={session} />

      <div className="flex-1 flex">
        {/* Sidebar */}
        <Sidebar
          folders={project.folders}
          activeFolder={activeFolder}
          onSelectFolder={setActiveFolder}
          onCreateFolder={handleCreateFolder}
          onDeleteFolder={handleDeleteFolder}
          projectName={project.name}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
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
              <button
                onClick={() => setShowShare(true)}
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                <span className="hidden sm:inline">Share</span>
              </button>
              {activeFolder && (
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
                            <DesignCard key={design.id} design={design} projectId={projectId} onDelete={() => fetchProject()} />
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
    </div>
  );
}
