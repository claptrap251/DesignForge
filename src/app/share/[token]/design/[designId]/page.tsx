"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import { useTheme } from "@/components/ThemeProvider";
import ImageViewer from "@/components/design/ImageViewer";
import MarkdownViewer from "@/components/design/MarkdownViewer";
import PinLayer from "@/components/comments/PinLayer";
import CommentSidebar from "@/components/comments/CommentSidebar";

function ShareDesignThemeToggle() {
  const { theme, setTheme } = useTheme();
  const cycle = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };
  return (
    <button onClick={cycle} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700" title={`Theme: ${theme}`}>
      {theme === "light" && (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="5" /><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
      )}
      {theme === "dark" && (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg>
      )}
      {theme === "system" && (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8m-4-4v4" /></svg>
      )}
    </button>
  );
}

export default function SharedDesignViewerPage() {
  const params = useParams();
  const router = useRouter();
  const designId = params.designId as string;
  const token = params.token as string;

  const [design, setDesign] = useState<any>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentSidebarOpen, setCommentSidebarOpen] = useState(false);

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

  const handleAddComment = async (
    x: number,
    y: number,
    content: string,
    authorName: string
  ) => {
    await fetch(apiUrl(`/api/designs/${designId}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xPercent: x, yPercent: y, content, authorName }),
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
    authorName: string
  ) => {
    await fetch(apiUrl(`/api/comments/${commentId}/replies`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName }),
    });
    fetchDesign();
  };

  const viewerRef = useRef<HTMLDivElement>(null);

  const handleScrollToComment = (commentId: string) => {
    const comment = design?.comments?.find((c: any) => c.id === commentId);
    if (!comment || comment.xPercent == null || comment.yPercent == null || !viewerRef.current) return;
    const container = viewerRef.current.querySelector("[class*='overflow-auto']") as HTMLElement || viewerRef.current;
    const targetY = (comment.yPercent / 100) * container.scrollHeight;
    container.scrollTo({
      top: targetY - container.clientHeight / 2,
      behavior: "smooth",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!design) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Design not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/share/${token}`)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-bold text-indigo-600">DesignForge</span>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <h2 className="font-medium text-gray-900 dark:text-gray-100 truncate max-w-[120px] sm:max-w-none">{design.name}</h2>
          <span className="text-xs bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded hidden sm:inline">
            Shared
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ShareDesignThemeToggle />
          <button
            onClick={() => setIsAddMode(!isAddMode)}
            className={`px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
              isAddMode
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isAddMode ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              )}
            </svg>
            <span className="hidden sm:inline">{isAddMode ? "Cancel" : "Add Comment"}</span>
          </button>
          <button
            onClick={() => setCommentSidebarOpen(true)}
            className="lg:hidden flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            aria-label="Show comments"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            <span className="text-xs font-medium">{design.comments?.length || 0}</span>
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div ref={viewerRef} className="flex-1 relative overflow-auto bg-gray-100 dark:bg-gray-800">
          {design.type === "IMAGE" ? (
            <ImageViewer src={apiUrl(`/api/uploads/${design.filePath}`)}>
              <PinLayer
                comments={design.comments || []}
                selectedCommentId={selectedCommentId}
                onSelectComment={setSelectedCommentId}
                onAddComment={handleAddComment}
                isAddMode={isAddMode}
              />
            </ImageViewer>
          ) : (
            <MarkdownViewer content={design.content || ""}>
              <PinLayer
                comments={design.comments || []}
                selectedCommentId={selectedCommentId}
                onSelectComment={setSelectedCommentId}
                onAddComment={handleAddComment}
                isAddMode={isAddMode}
              />
            </MarkdownViewer>
          )}
        </div>

        <CommentSidebar
          comments={design.comments || []}
          onResolve={handleResolve}
          onReply={handleReply}
          selectedCommentId={selectedCommentId}
          onSelectComment={setSelectedCommentId}
          mobileOpen={commentSidebarOpen}
          onMobileClose={() => setCommentSidebarOpen(false)}
          onScrollToComment={handleScrollToComment}
        />
      </div>
    </div>
  );
}
