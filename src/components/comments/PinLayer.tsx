"use client";

import { useState, useCallback } from "react";
import CommentPin from "./CommentPin";
import CommentForm from "./CommentForm";

interface PinLayerProps {
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (x: number, y: number, content: string, authorName: string, authorId?: string) => void;
  isAddMode: boolean;
  sessionUser?: { id: string; name?: string; username?: string };
}

export default function PinLayer({
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  isAddMode,
  sessionUser,
}: PinLayerProps) {
  const [newPinPosition, setNewPinPosition] = useState<{ x: number; y: number } | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isAddMode) {
        onSelectComment(null);
        return;
      }

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      // Use offsetWidth/offsetHeight for zoom-independent sizing
      const scaleX = el.offsetWidth / rect.width;
      const scaleY = el.offsetHeight / rect.height;
      const x = ((e.clientX - rect.left) * scaleX / el.offsetWidth) * 100;
      const y = ((e.clientY - rect.top) * scaleY / el.offsetHeight) * 100;
      setNewPinPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
    },
    [isAddMode, onSelectComment]
  );

  const handleFormSubmit = (content: string, authorName: string, authorId?: string) => {
    if (newPinPosition) {
      onAddComment(newPinPosition.x, newPinPosition.y, content, authorName, authorId);
      setNewPinPosition(null);
    }
  };

  const handleFormCancel = () => {
    setNewPinPosition(null);
  };

  // When not in add mode, render pins directly without an overlay so text selection works
  if (!isAddMode) {
    return (
      <>
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
      </>
    );
  }

  return (
    <div
      className="absolute inset-0 z-10 cursor-crosshair"
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
            sessionUser={sessionUser}
          />
        </>
      )}
    </div>
  );
}
