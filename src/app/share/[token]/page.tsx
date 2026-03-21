"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { useTheme } from "@/components/ThemeProvider";
import DesignGrid from "@/components/design/DesignGrid";
import PasswordGate from "@/components/share/PasswordGate";

function ShareThemeToggle() {
  const { theme, setTheme } = useTheme();
  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };
  return (
    <button onClick={cycle} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title={`Theme: ${theme}`}>
      {theme === "light" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
      )}
      {theme === "dark" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
      )}
      {theme === "system" && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>
      )}
    </button>
  );
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [project, setProject] = useState<any>(null);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchSharedProject = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/share/${token}`));
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold text-indigo-600">DesignForge</span>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <span className="text-gray-600 dark:text-gray-300 font-medium">{project?.name}</span>
            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
              Shared
            </span>
          </div>
          <ShareThemeToggle />
        </div>
      </header>

      <div className="flex">
        {/* Folder list */}
        <div className="w-60 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-[calc(100vh-4rem)] p-4">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
            Folders
          </h3>
          {project?.folders?.map((folder: any) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
                activeFolder === folder.id
                  ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              {folder.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
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
            <p className="text-gray-500 dark:text-gray-400">Select a folder to view designs</p>
          )}
        </main>
      </div>
    </div>
  );
}
