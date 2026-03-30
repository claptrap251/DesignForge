"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";
import ImageViewer from "@/components/design/ImageViewer";
import MarkdownViewer from "@/components/design/MarkdownViewer";
import PinLayer from "@/components/comments/PinLayer";
import CommentSidebar from "@/components/comments/CommentSidebar";
import CommentForm from "@/components/comments/CommentForm";
import { computeAnchor } from "@/lib/anchor";
import { copyToClipboard } from "@/lib/clipboard";
import VersionHistory from "@/components/design/VersionHistory";
import UploadNewVersion from "@/components/design/UploadNewVersion";
import MarkdownEditor from "@/components/design/MarkdownEditor";
import RelatedDesigns from "@/components/design/RelatedDesigns";
import type { SidebarTab } from "@/components/comments/CommentSidebar";

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
  const [baseVersionContent, setBaseVersionContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const markdownContentRef = useRef<HTMLDivElement>(null);
  const [pendingAnchorLine, setPendingAnchorLine] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("comments");

  const sessionUser = session?.user?.id
    ? { id: session.user.id, name: session.user.name ?? undefined, username: (session.user as any).username ?? undefined }
    : undefined;

  const fetchDesign = useCallback(async () => {
    const res = await fetch(apiUrl(`/api/designs/${designId}`));
    if (res.ok) {
      setDesign(await res.json());
    }
    setLoading(false);
  }, [designId]);

  useEffect(() => {
    fetchDesign();
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

  // Close status menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setShowStatusMenu(false);
      }
    };
    if (showStatusMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showStatusMenu]);

  const handleStatusChange = async (newStatus: "DRAFT" | "IN_REVIEW" | "APPROVED") => {
    setStatusUpdating(true);
    setShowStatusMenu(false);
    try {
      await fetch(apiUrl(`/api/designs/${designId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchDesign();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleExportDesign = async (format: "md" | "html" | "docx" | "confluence") => {
    setExporting(true);
    setShowExportMenu(false);

    try {
      const res = await fetch(apiUrl(`/api/designs/${designId}/export?format=${format}`));
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
      const res = await fetch(apiUrl(`/api/designs/${designId}/export?format=confluence`));
      if (!res.ok) throw new Error("Export failed");
      const text = await res.text();
      await copyToClipboard(text);
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
    authorId?: string,
    anchorText?: string
  ) => {
    await fetch(apiUrl(`/api/designs/${designId}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xPercent: x, yPercent: y, content, authorName, ...(authorId ? { authorId } : {}), ...(anchorText ? { anchorText } : {}) }),
    });
    setIsAddMode(false);
    fetchDesign();
  };

  const handleResolve = async (commentId: string) => {
    const comment = design.comments.find((c: any) => c.id === commentId);
    await fetch(apiUrl(`/api/comments/${commentId}`), {
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
    await fetch(apiUrl(`/api/comments/${commentId}/replies`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName, ...(authorId ? { authorId } : {}) }),
    });
    fetchDesign();
  };

  const handleDeleteComment = async (commentId: string) => {
    await fetch(apiUrl(`/api/comments/${commentId}`), { method: "DELETE" });
    setSelectedCommentId(null);
    fetchDesign();
  };

  const handleAddMarkdownComment = (line: number) => {
    setPendingAnchorLine(line);
  };

  const handleSubmitMarkdownComment = async (content: string, authorName: string, authorId?: string) => {
    if (pendingAnchorLine === null) return;
    const mdContent = viewingVersion?.content || design?.content || "";
    const anchor = computeAnchor(pendingAnchorLine, mdContent);

    await fetch(apiUrl(`/api/designs/${designId}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        anchorLine: anchor.anchorLine,
        anchorHeading: anchor.anchorHeading,
        anchorContext: anchor.anchorContext,
        contextBefore: anchor.contextBefore,
        contextAfter: anchor.contextAfter,
        content,
        authorName,
        ...(authorId ? { authorId } : {}),
      }),
    });
    setPendingAnchorLine(null);
    setIsAddMode(false);
    fetchDesign();
  };

  const viewerRef = useRef<HTMLDivElement>(null);

  const handleScrollToComment = (commentId: string) => {
    const comment = design?.comments?.find((c: any) => c.id === commentId);
    if (!comment) return;

    // Anchor-line based: scroll to the rendered element
    if (comment.anchorLine && markdownContentRef.current) {
      const el = markdownContentRef.current.querySelector(
        `[data-source-line="${comment.anchorLine}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement).classList.add("bg-yellow-100");
        setTimeout(() => (el as HTMLElement).classList.remove("bg-yellow-100"), 1500);
        return;
      }
    }

    // Pin-based: scroll the viewer container so the pin position is visible
    if (comment.xPercent != null && comment.yPercent != null && viewerRef.current) {
      // Find the actual scroll container (MarkdownViewer or ImageViewer inner div)
      const container = viewerRef.current.querySelector("[class*='overflow-auto']") as HTMLElement || viewerRef.current;
      const targetY = (comment.yPercent / 100) * container.scrollHeight;
      container.scrollTo({
        top: targetY - container.clientHeight / 2,
        behavior: "smooth",
      });
    }
  };

  const visibleComments = useMemo(() => {
    const comments = design?.comments || [];
    // Determine which content to check anchors against
    const activeContent = viewingVersion && viewingVersion.version !== design?.currentVersion
      ? viewingVersion.content
      : design?.content;

    const filtered = viewingVersion && viewingVersion.version !== design?.currentVersion
      ? comments.filter((c: any) => !c.version || c.version <= viewingVersion.version)
      : comments;

    // Compute per-version discard: if anchorText doesn't exist in the viewed content
    if (activeContent && design?.type === "MARKDOWN") {
      return filtered.map((c: any) => {
        if (c.anchorText) {
          const exists = activeContent.includes(c.anchorText);
          return { ...c, discarded: !exists };
        }
        return c;
      });
    }
    return filtered;
  }, [design, viewingVersion]);

  const handleCreateFromVersion = (version: any) => {
    if (design.type === "MARKDOWN" && version.content) {
      setBaseVersionContent(version.content);
    }
    setShowUploadVersion(true);
  };

  const handleEditorSave = async (newContent: string, changeNote: string) => {
    const formData = new FormData();
    formData.append("content", newContent);
    if (changeNote.trim()) {
      formData.append("changeNote", changeNote.trim());
    }
    const res = await fetch(apiUrl(`/api/designs/${designId}`), {
      method: "PUT",
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Save failed");
    }
    setIsEditing(false);
    fetchDesign();
  };

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
        </div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <Header session={session} />
        <div className="flex items-center justify-center h-96">
          <p style={{ color: 'var(--text-tertiary)' }}>Design not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <Header session={session} />

      {/* Toolbar */}
      <div className="shrink-0 border-b px-4 py-2 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/project/${projectId}`)}
            className="hover-warm"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-center gap-1 min-w-0">
            {design.folderPath && design.folderPath.length > 0 && (
              <span className="hidden sm:flex items-center gap-1 text-sm shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                {design.folderPath.map((f: { id: string; name: string }, i: number) => (
                  <span key={f.id} className="flex items-center gap-1">
                    {i > 0 && <span>/</span>}
                    <button
                      onClick={() => router.push(`/project/${projectId}?folder=${f.id}`)}
                      className="hover-warm hover:underline"
                    >
                      {f.name}
                    </button>
                  </span>
                ))}
                <span>/</span>
              </span>
            )}
            <h2 className="font-medium truncate max-w-[120px] sm:max-w-none" style={{ color: 'var(--text-primary)' }}>{design.name}</h2>
          </div>
          <span className="text-xs px-2 py-0.5 rounded hidden sm:inline" style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-code)' }}>
            {design.type}
          </span>
          {/* Status selector */}
          <div className="relative" ref={statusMenuRef}>
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={statusUpdating}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition disabled:opacity-50"
              style={{
                borderRadius: '3px',
                ...(design.status === "APPROVED"
                  ? { color: 'var(--badge-approved)', backgroundColor: 'var(--badge-approved-bg)' }
                  : design.status === "IN_REVIEW"
                  ? { color: 'var(--badge-review)', backgroundColor: 'var(--badge-review-bg)' }
                  : { color: 'var(--badge-draft)', backgroundColor: 'var(--badge-draft-bg)' }),
              }}
            >
              {statusUpdating ? "Updating..." : design.status === "IN_REVIEW" ? "In Review" : design.status === "APPROVED" ? "Approved" : "Draft"}
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStatusMenu && (
              <div className="absolute left-0 top-full mt-1 w-40 rounded-lg py-1 shadow-lg z-30" style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)' }}>
                <button
                  onClick={() => handleStatusChange("DRAFT")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--badge-draft)' }} />
                  Draft
                  {design.status === "DRAFT" && (
                    <svg className="ml-auto h-4 w-4" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleStatusChange("IN_REVIEW")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--badge-review)' }} />
                  In Review
                  {design.status === "IN_REVIEW" && (
                    <svg className="ml-auto h-4 w-4" style={{ color: 'var(--badge-review)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => handleStatusChange("APPROVED")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--badge-approved)' }} />
                  Approved
                  {design.status === "APPROVED" && (
                    <svg className="ml-auto h-4 w-4" style={{ color: 'var(--badge-approved)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </div>
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
            onCreateFromVersion={handleCreateFromVersion}
          />
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover-warm disabled:opacity-50"
              style={{ color: 'var(--text-secondary)' }}
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
              <div className="absolute right-0 top-full mt-1 w-52 rounded-lg py-1 shadow-lg z-20" style={{ backgroundColor: 'var(--bg-page)', border: '1px solid var(--border-subtle)' }}>
                {design.type === "MARKDOWN" && design.content && (
                  <button
                    onClick={() => handleExportDesign("md")}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>MD</span>
                    Markdown
                  </button>
                )}
                <button
                  onClick={() => handleExportDesign("html")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--text-tertiary)' }}>{"<>"}</span>
                  HTML
                </button>
                <button
                  onClick={() => handleExportDesign("docx")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--accent)' }}>W</span>
                  Word
                </button>
                <button
                  onClick={() => handleExportDesign("confluence")}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <span className="w-5 text-center text-xs font-bold" style={{ color: 'var(--accent)' }}>C</span>
                  Confluence
                </button>
                <div className="my-1" style={{ borderTop: '1px solid var(--border-subtle)' }} />
                <button
                  onClick={handleCopyConfluence}
                  disabled={copyStatus === "copying"}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover-warm disabled:opacity-50"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <svg className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  {copyStatus === "copying" ? "Copying..." : "Copy Confluence"}
                </button>
              </div>
            )}
          </div>
          {design.type === "MARKDOWN" && !isEditing && (!viewingVersion || viewingVersion.version === design.currentVersion) && sessionUser?.username && design.ownerUsername === sessionUser.username && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover-warm"
              style={{ color: 'var(--text-secondary)' }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
          {!isEditing && sessionUser?.username && design.ownerUsername === sessionUser.username && (
          <button
            onClick={() => setShowUploadVersion(true)}
            className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium hover-warm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">New Version</span>
          </button>
          )}
          {!isEditing && (
          <button
            onClick={() => setIsAddMode(!isAddMode)}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
              isAddMode
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "text-white"
            }`}
            style={!isAddMode ? { backgroundColor: 'var(--accent)' } : undefined}
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
          )}
          {/* Mobile comments toggle */}
          {!isEditing && (
          <button
            onClick={() => setCommentSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium hover-warm"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Show comments"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span className="text-xs font-medium">{visibleComments.length}</span>
          </button>
          )}
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

      {/* Editing banner */}
      {isEditing && (
        <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700 px-4 py-2 text-center text-sm text-amber-800 dark:text-amber-300">
          Editing — changes will create a new version
        </div>
      )}

      {/* Main content with sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Design viewer / editor */}
        <div ref={viewerRef} className="flex-1 relative overflow-auto bg-gray-100 dark:bg-gray-800">
          {isEditing && design.type === "MARKDOWN" ? (
            <MarkdownEditor
              content={design.content || ""}
              onSave={handleEditorSave}
              onCancel={() => setIsEditing(false)}
            />
          ) : design.type === "IMAGE" ? (
            <ImageViewer
              src={
                viewingVersion && viewingVersion.version !== design.currentVersion
                  ? apiUrl(`/api/uploads/${viewingVersion.filePath}`)
                  : apiUrl(`/api/uploads/${design.filePath}`)
              }
            >
              <PinLayer
                comments={visibleComments}
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
                comments={visibleComments}
                selectedCommentId={selectedCommentId}
                onSelectComment={setSelectedCommentId}
                onAddComment={handleAddComment}
                isAddMode={isAddMode}
                isMarkdown={true}
                sessionUser={sessionUser}
              />
            </MarkdownViewer>
          )}
        </div>

        {/* Comment sidebar - hidden during editing */}
        {!isEditing && (
        <CommentSidebar
          comments={visibleComments}
          onResolve={handleResolve}
          onReply={handleReply}
          onDelete={handleDeleteComment}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
          mobileOpen={commentSidebarOpen}
          onMobileClose={() => setCommentSidebarOpen(false)}
          sessionUser={sessionUser}
          onScrollToComment={handleScrollToComment}
          activeTab={sidebarTab}
          onTabChange={setSidebarTab}
          relatedContent={
            design.type === "MARKDOWN"
              ? <RelatedDesigns designId={designId} projectId={projectId} />
              : undefined
          }
        />
        )}
      </div>

      {/* Upload new version modal */}
      {showUploadVersion && (
        <UploadNewVersion
          designId={designId}
          designType={design.type}
          currentContent={design.type === "MARKDOWN" ? (baseVersionContent || design.content) : null}
          onComplete={() => {
            setShowUploadVersion(false);
            setBaseVersionContent(null);
            setViewingVersion(null);
            fetchDesign();
          }}
          onClose={() => {
            setShowUploadVersion(false);
            setBaseVersionContent(null);
          }}
        />
      )}
      {/* Markdown anchor comment form */}
      {pendingAnchorLine !== null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="mb-1 text-center">
            <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ color: 'var(--accent)', backgroundColor: 'var(--bg-code)' }}>
              Commenting on line {pendingAnchorLine}
            </span>
          </div>
          <CommentForm
            onSubmit={handleSubmitMarkdownComment}
            onCancel={() => setPendingAnchorLine(null)}
            sessionUser={sessionUser}
          />
        </div>
      )}
    </div>
  );
}
