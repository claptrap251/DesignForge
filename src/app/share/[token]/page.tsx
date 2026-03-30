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
    <button onClick={cycle} className="rounded-lg p-2" style={{ color: 'var(--text-tertiary)' }} title={`Theme: ${theme}`}>
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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
      </div>
    );
  }

  if (needsPassword) {
    return <PasswordGate token={token} onVerified={handlePasswordVerified} />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            Link Unavailable
          </h2>
          <p style={{ color: 'var(--text-tertiary)' }}>{error}</p>
        </div>
      </div>
    );
  }

  const activeFolderData = project?.folders?.find(
    (f: any) => f.id === activeFolder
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold" style={{ color: 'var(--accent)' }}>DesignForge</span>
            <span style={{ color: 'var(--border-subtle)' }}>|</span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>{project?.name}</span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
              Shared
            </span>
          </div>
          <ShareThemeToggle />
        </div>
      </header>

      <div className="flex">
        {/* Folder list */}
        <div className="w-60 border-r min-h-[calc(100vh-4rem)] p-4" style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Folders
          </h3>
          {project?.folders?.map((folder: any) => (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition ${
                activeFolder === folder.id
                  ? "font-medium"
                  : ""
              }`}
              style={
                activeFolder === folder.id
                  ? { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {folder.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <main className="flex-1 p-6">
          <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
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
            <p style={{ color: 'var(--text-tertiary)' }}>Select a folder to view designs</p>
          )}
        </main>
      </div>
    </div>
  );
}
