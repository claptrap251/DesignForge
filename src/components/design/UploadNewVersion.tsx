"use client";

import { useState, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/basePath";

interface UploadNewVersionProps {
  designId: string;
  designType: string;
  currentContent?: string | null;
  onComplete: () => void;
  onClose: () => void;
}

export default function UploadNewVersion({
  designId,
  designType,
  currentContent,
  onComplete,
  onClose,
}: UploadNewVersionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [markdownContent, setMarkdownContent] = useState(currentContent || "");
  const [changeNote, setChangeNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();

      if (designType === "IMAGE") {
        if (!selectedFile) return;
        formData.append("file", selectedFile);
      } else {
        if (!markdownContent.trim()) return;
        formData.append("content", markdownContent);
      }

      if (changeNote.trim()) {
        formData.append("changeNote", changeNote.trim());
      }

      const res = await fetch(apiUrl(`/api/designs/${designId}`), {
        method: "PUT",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      onComplete();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white dark:bg-gray-800 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Upload New Version
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Comments will be preserved across versions.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {designType === "IMAGE" ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 hover:border-indigo-300 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-indigo-500"
          >
            {preview ? (
              <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
            ) : (
              <>
                <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Drop the updated design here
                </p>
              </>
            )}
          </div>
        ) : (
          <textarea
            value={markdownContent}
            onChange={(e) => setMarkdownContent(e.target.value)}
            rows={10}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 font-mono text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Change note (optional)
          </label>
          <input
            type="text"
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Updated color scheme, fixed alignment..."
            className="mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || (designType === "IMAGE" ? !selectedFile : !markdownContent.trim())}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload New Version"}
          </button>
        </div>
      </div>
    </div>
  );
}
