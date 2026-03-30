"use client";

import { useState, useCallback } from "react";
import CommentPin from "./CommentPin";
import CommentForm from "./CommentForm";

interface PinLayerProps {
  comments: any[];
  selectedCommentId: string | null;
  onSelectComment: (id: string | null) => void;
  onAddComment: (x: number, y: number, content: string, authorName: string, authorId?: string, anchorText?: string) => void;
  isAddMode: boolean;
  isMarkdown?: boolean;
  sessionUser?: { id: string; name?: string; username?: string };
}

/** Extract the word at the click point + one neighbor for uniqueness */
function getTextAtPoint(clientX: number, clientY: number): string | null {
  try {
    const range = document.caretRangeFromPoint(clientX, clientY);
    if (!range || !range.startContainer || range.startContainer.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    const textNode = range.startContainer as Text;
    const text = textNode.textContent || "";
    const offset = range.startOffset;

    const before = text.slice(0, offset);
    const after = text.slice(offset);

    // Grab the clicked word + one word on each side
    const wordBeforeMatch = before.match(/(?:\S+\s+)?\S*$/);
    const wordAfterMatch = after.match(/^\S*(?:\s+\S+)?/);

    const snippetBefore = wordBeforeMatch ? wordBeforeMatch[0] : "";
    const snippetAfter = wordAfterMatch ? wordAfterMatch[0] : "";
    const phrase = (snippetBefore + snippetAfter).trim();

    return phrase.length >= 2 ? phrase : null;
  } catch {
    return null;
  }
}

export default function PinLayer({
  comments,
  selectedCommentId,
  onSelectComment,
  onAddComment,
  isAddMode,
  isMarkdown,
  sessionUser,
}: PinLayerProps) {
  const [newPinPosition, setNewPinPosition] = useState<{ x: number; y: number; anchorText?: string } | null>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isAddMode) {
        onSelectComment(null);
        return;
      }

      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      const scaleX = el.offsetWidth / rect.width;
      const scaleY = el.offsetHeight / rect.height;
      const x = ((e.clientX - rect.left) * scaleX / el.offsetWidth) * 100;
      const y = ((e.clientY - rect.top) * scaleY / el.offsetHeight) * 100;

      // For markdown designs, try to anchor to text
      let anchorText: string | undefined;
      if (isMarkdown) {
        const text = getTextAtPoint(e.clientX, e.clientY);
        if (text) anchorText = text;
      }

      setNewPinPosition({
        x: Math.max(0, Math.min(100, x)),
        y: Math.max(0, Math.min(100, y)),
        anchorText,
      });
    },
    [isAddMode, isMarkdown, onSelectComment]
  );

  const handleFormSubmit = (content: string, authorName: string, authorId?: string) => {
    if (newPinPosition) {
      onAddComment(newPinPosition.x, newPinPosition.y, content, authorName, authorId, newPinPosition.anchorText);
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
              discarded: comment.discarded,
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
            discarded: comment.discarded,
            content: comment.content,
          }}
          isSelected={selectedCommentId === comment.id}
          onClick={onSelectComment}
        />
      ))}

      {newPinPosition && (
        <>
          <div
            className="absolute z-20 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-md"
            style={{
              left: `${newPinPosition.x}%`,
              top: `${newPinPosition.y}%`,
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 0 2px var(--accent-bg)',
            }}
          >
            +
          </div>
          {newPinPosition.anchorText && (
            <div
              className="absolute z-20 -translate-x-1/2 mt-5 rounded bg-gray-900/90 px-2 py-1 text-[10px] text-gray-300 max-w-[200px] truncate"
              style={{
                left: `${newPinPosition.x}%`,
                top: `${newPinPosition.y}%`,
              }}
            >
              Anchored: &quot;{newPinPosition.anchorText}&quot;
            </div>
          )}
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
