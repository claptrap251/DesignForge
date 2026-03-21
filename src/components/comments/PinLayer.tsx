"use client";

import { useState, useCallback } from "react";
import CommentPin from "./CommentPin";
import CommentForm from "./CommentForm";

interface PinLayerProps {
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (x: number, y: number, content: string, authorName: string) => void;
  isAddMode: boolean;
}

export default function PinLayer({
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  isAddMode,
}: PinLayerProps) {
  const [newPinPosition, setNewPinPosition] = useState<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isAddMode) {
        onSelectComment(null);
        return;
      }

      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setNewPinPosition({ x, y });
    },
    [isAddMode, onSelectComment]
  );

  const handleFormSubmit = (content: string, authorName: string) => {
    if (newPinPosition) {
      onAddComment(newPinPosition.x, newPinPosition.y, content, authorName);
      setNewPinPosition(null);
    }
  };

  const handleFormCancel = () => {
    setNewPinPosition(null);
  };

  return (
    <div
      className={`absolute inset-0 z-10 ${isAddMode ? "cursor-crosshair" : ""}`}
      onClick={handleClick}
    >
      {comments.map((comment) => (
        <CommentPin
          key={comment.id}
          pin={{
            id: comment.id,
            pinNumber: comment.pinNumber,
            xPercent: comment.xPercent,
            yPercent: comment.yPercent,
            resolved: comment.resolved,
            content: comment.content,
          }}
          isSelected={selectedCommentId === comment.id}
          onClick={onSelectComment}
        />
      ))}

      {newPinPosition && (
        <>
          <div
            className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-md ring-2 ring-indigo-300"
            style={{
              left: `${newPinPosition.x}%`,
              top: `${newPinPosition.y}%`,
            }}
          >
            +
          </div>
          <CommentForm
            position={newPinPosition}
            onSubmit={handleFormSubmit}
            onCancel={handleFormCancel}
          />
        </>
      )}
    </div>
  );
}
