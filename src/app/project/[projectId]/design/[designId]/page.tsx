"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import ImageViewer from "@/components/design/ImageViewer";
import MarkdownViewer from "@/components/design/MarkdownViewer";
import PinLayer from "@/components/comments/PinLayer";
import CommentSidebar from "@/components/comments/CommentSidebar";
import VersionHistory from "@/components/design/VersionHistory";
import UploadNewVersion from "@/components/design/UploadNewVersion";

export default function DesignViewerPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const designId = params.designId as string;
  const projectId = params.projectId as string;

  const [design, setDesign] = useState<any>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [showUploadVersion, setShowUploadVersion] = useState(false);
  const [viewingVersion, setViewingVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const sessionUser = session?.user
    ? { id: session.user.id, name: session.user.name ?? undefined, username: (session.user as any).username ?? undefined }
    : undefined;

  const fetchDesign = useCallback(async () => {
    const res = await fetch(`/api/designs/${designId}`);
    if (res.ok) {
      setDesign(await res.json());
    }
    setLoading(false);
  }, [designId]);

  useEffect(() => {
    fetchDesign();
    const interval = setInterval(fetchDesign, 5000);
    return () => clearInterval(interval);
  }, [fetchDesign]);

  // Close export menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    if (showExportMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showExportMenu]);

  const handleExportDesign = async (format: "md" | "html" | "docx" | "confluence") => {
    setExporting(true);
    setShowExportMenu(false);

    try {
      const res = await fetch(`/api/designs/${designId}/export?format=${format}`);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();

      const extMap: Record<string, string> = { md: "md", html: "html", docx: "docx", confluence: "html" };
      const suffixMap: Record<string, string> = { confluence: "-confluence" };
      const ext = extMap[format] || format;
      const suffix = suffixMap[format] || "";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${design?.name || "design"}${suffix}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyConfluence = async () => {
    setCopyStatus("copying");
    setShowExportMenu(false);
    try {
      const res = await fetch(`/api/designs/${designId}/export?format=confluence`);
      if (!res.ok) throw new Error("Export failed");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  };

  const handleAddComment = async (
    x: number,
    y: number,
    content: string,
    authorName: string,
    authorId?: string
  ) => {
    await fetch(`/api/designs/${designId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xPercent: x, yPercent: y, content, authorName, ...(authorId ? { authorId } : {}) }),
    });
    setIsAddMode(false);
    fetchDesign();
  };

  const handleResolve = async (commentId: string) => {
    const comment = design.comments.find((c: any) => c.id === commentId);
    await fetch(`/api/comments/${commentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !comment.resolved }),
    });
    fetchDesign();
  };

  const handleReply = async (
    commentId: string,
    content: string,
    authorName: string,
    authorId?: string
  ) => {
    await fetch(`/api/comments/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName, ...(authorId ? { authorId } : {}) }),
    });
    fetchDesign();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-500">Design not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header session={session} />

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="font-medium text-gray-900 truncate max-w-[120px] sm:max-w-none">{design.name}</h2>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded hidden sm:inline">
            {design.type}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {viewingVersion && viewingVersion.version !== design.currentVersion && (
            <button
              onClick={() => setViewingVersion(null)}
              className="flex items-center gap-1 rounded-lg bg-amber-100 px-2 sm:px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline">Back to current (v{design.currentVersion})</span>
            </button>
          )}
          <VersionHistory
            versions={design.versions || []}
            currentVersion={design.currentVersion || 1}
            designType={design.type}
            onViewVersion={(version) => {
              if (version.version === design.currentVersion) {
                setViewingVersion(null);
              } else {
                setViewingVersion(version);
              }
            }}
          />
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="hidden sm:inline">{exporting ? "Exporting..." : "Export"}</span>
              <svg className="h-3 w-3 ml-0.5 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-20">
                {design.type === "MARKDOWN" && design.content && (
                  <button
                    onClick={() => handleExportDesign("md")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <span className="w-5 text-center text-xs font-bold text-gray-400">MD</span>
                    Markdown
                  </button>
                )}
                <button
                  onClick={() => handleExportDesign("html")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="w-5 text-center text-xs font-bold text-gray-400">{"<>"}</span>
                  HTML
                </button>
                <button
                  onClick={() => handleExportDesign("docx")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="w-5 text-center text-xs font-bold text-blue-400">W</span>
                  Word
                </button>
                <button
                  onClick={() => handleExportDesign("confluence")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <span className="w-5 text-center text-xs font-bold text-indigo-400">C</span>
                  Confluence
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button
                  onClick={handleCopyConfluence}
                  disabled={copyStatus === "copying"}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copyStatus === "copying" ? "Copying..." : "Copy Confluence"}
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowUploadVersion(true)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">New Version</span>
          </button>
          <button
            onClick={() => setIsAddMode(!isAddMode)}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
              isAddMode
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {isAddMode ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Cancel</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">Add Comment</span>
              </>
            )}
          </button>
          {/* Mobile comments toggle */}
          <button
            onClick={() => setCommentSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            aria-label="Show comments"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span className="text-xs font-medium">{design.comments?.length || 0}</span>
          </button>
        </div>
      </div>

      {/* Copy status toast */}
      {copyStatus === "copied" && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Confluence markup copied to clipboard
        </div>
      )}
      {copyStatus === "error" && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          Failed to copy — try downloading instead
        </div>
      )}

      {/* Viewing old version banner */}
      {viewingVersion && viewingVersion.version !== design.currentVersion && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800">
          Viewing version {viewingVersion.version} of {design.versions?.length || 1}
          {viewingVersion.changeNote && (
            <span className="ml-2 text-amber-600">— {viewingVersion.changeNote}</span>
          )}
        </div>
      )}

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Design viewer */}
        <div className="flex-1 relative overflow-auto bg-gray-100">
          {design.type === "IMAGE" ? (
            <ImageViewer
              src={
                viewingVersion && viewingVersion.version !== design.currentVersion
                  ? `/api/uploads/${viewingVersion.filePath}`
                  : `/api/uploads/${design.filePath}`
              }
            >
              <PinLayer
                comments={design.comments || []}
                selectedCommentId={selectedCommentId}
                onSelectComment={setSelectedCommentId}
                onAddComment={handleAddComment}
                isAddMode={isAddMode}
                sessionUser={sessionUser}
              />
            </ImageViewer>
          ) : (
            <MarkdownViewer
              content={
                viewingVersion && viewingVersion.version !== design.currentVersion
                  ? viewingVersion.content || ""
                  : design.content || ""
              }
            >
              <PinLayer
                comments={design.comments || []}
                selectedCommentId={selectedCommentId}
                onSelectComment={setSelectedCommentId}
                onAddComment={handleAddComment}
                isAddMode={isAddMode}
                sessionUser={sessionUser}
              />
            </MarkdownViewer>
          )}
        </div>

        {/* Comment sidebar */}
        <CommentSidebar
          comments={design.comments || []}
          onResolve={handleResolve}
          onReply={handleReply}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
          mobileOpen={commentSidebarOpen}
          onMobileClose={() => setCommentSidebarOpen(false)}
          sessionUser={sessionUser}
        />
      </div>

      {/* Upload new version modal */}
      {showUploadVersion && (
        <UploadNewVersion
          designId={designId}
          designType={design.type}
          currentContent={design.type === "MARKDOWN" ? design.content : null}
          onComplete={() => {
            setShowUploadVersion(false);
            setViewingVersion(null);
            fetchDesign();
          }}
          onClose={() => setShowUploadVersion(false)}
        />
      )}
    </div>
  );
}
