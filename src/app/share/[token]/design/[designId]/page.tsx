"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import ImageViewer from "@/components/design/ImageViewer";
import MarkdownViewer from "@/components/design/MarkdownViewer";
import PinLayer from "@/components/comments/PinLayer";
import CommentSidebar from "@/components/comments/CommentSidebar";

export default function SharedDesignViewerPage() {
  const params = useParams();
  const router = useRouter();
  const designId = params.designId as string;
  const token = params.token as string;

  const [design, setDesign] = useState<any>(null);
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null);
  const [isAddMode, setIsAddMode] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleAddComment = async (
    x: number,
    y: number,
    content: string,
    authorName: string
  ) => {
    await fetch(`/api/designs/${designId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ xPercent: x, yPercent: y, content, authorName }),
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
    authorName: string
  ) => {
    await fetch(`/api/comments/${commentId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName }),
    });
    fetchDesign();
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/share/${token}`)}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-lg font-bold text-indigo-600">DesignForge</span>
          <span className="text-gray-300">|</span>
          <h2 className="font-medium text-gray-900">{design.name}</h2>
          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">
            Shared
          </span>
        </div>
        <button
          onClick={() => setIsAddMode(!isAddMode)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition flex items-center gap-1 ${
            isAddMode
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {isAddMode ? "Cancel" : "Add Comment"}
        </button>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-auto bg-gray-100">
          {design.type === "IMAGE" ? (
            <ImageViewer src={`/api/uploads/${design.filePath}`}>
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
        />
      </div>
    </div>
  );
}
