"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import DesignGrid from "@/components/design/DesignGrid";
import PasswordGate from "@/components/share/PasswordGate";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [project, setProject] = useState<any>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSharedProject = useCallback(async () => {
    const res = await fetch(`/api/share/${token}`);
    if (res.status === 401) {
      setNeedsPassword(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Invalid or expired share link");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setProject(data.project);
    if (data.project.folders?.length > 0) {
      setActiveFolder(data.project.folders[0].id);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    fetchSharedProject();
  }, [fetchSharedProject]);

  const handlePasswordVerified = (data: any) => {
    setProject(data.project);
    setNeedsPassword(false);
    if (data.project.folders?.length > 0) {
      setActiveFolder(data.project.folders[0].id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (needsPassword) {
    return <PasswordGate token={token} onVerified={handlePasswordVerified} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Link Unavailable
          </h2>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const activeFolderData = project?.folders?.find(
    (f: any) => f.id === activeFolder
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-indigo-600">DesignForge</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600 font-medium">{project?.name}</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
              Shared
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Folder list */}
        <div className="w-60 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] p-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Folders
          </h3>
          {project?.folders?.map((folder: any) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
                activeFolder === folder.id
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {folder.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            {activeFolderData?.name || "Select a folder"}
          </h2>
          {activeFolderData ? (
            <DesignGrid
              designs={activeFolderData.designs || []}
              folderId={activeFolder!}
              onUpload={() => {}}
              projectId={project.id}
              shareToken={token}
            />
          ) : (
            <p className="text-gray-500">Select a folder to view designs</p>
          )}
        </main>
      </div>
    </div>
  );
}
