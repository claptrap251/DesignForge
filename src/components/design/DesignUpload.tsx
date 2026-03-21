"use client";

import { useState, useRef, useCallback } from "react";

interface DesignUploadProps {
  folderId: string;
  onUploadComplete: () => void;
  onClose?: () => void;
}

export default function DesignUpload({ folderId, onUploadComplete, onClose }: DesignUploadProps) {
  const [activeTab, setActiveTab] = useState<"image" | "markdown">("image");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [markdownName, setMarkdownName] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleImageUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folderId", folderId);
      formData.append("type", "image");
      formData.append("name", selectedFile.name);

      const res = await fetch("/api/designs", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      setSelectedFile(null);
      setPreview(null);
      onUploadComplete();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleMarkdownSubmit = async () => {
    if (!markdownName.trim() || !markdownContent.trim()) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          folderId,
          type: "markdown",
          name: markdownName.trim(),
          content: markdownContent,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Creation failed");
      }

      setMarkdownName("");
      setMarkdownContent("");
      onUploadComplete();
    } catch (err: any) {
      setError(err.message || "Creation failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex gap-1 rounded-lg bg-gray-100 p-1">
        <button
          onClick={() => setActiveTab("image")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "image"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Upload Image
        </button>
        <button
          onClick={() => setActiveTab("markdown")}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "markdown"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Write Markdown
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {activeTab === "image" ? (
        <div>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-gray-100"
            }`}
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="max-h-48 rounded-lg object-contain"
              />
            ) : (
              <>
                <svg
                  className="h-10 w-10 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="mt-2 text-sm font-medium text-gray-600">
                  Drop an image here or click to browse
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  PNG, JPG, GIF, SVG, WebP
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {selectedFile && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-gray-600">{selectedFile.name}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setPreview(null);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Clear
                </button>
                <button
                  onClick={handleImageUpload}
                  disabled={uploading}
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label htmlFor="md-name" className="block text-sm font-medium text-gray-700">
              Name
            </label>
            <input
              id="md-name"
              type="text"
              value={markdownName}
              onChange={(e) => setMarkdownName(e.target.value)}
              placeholder="Document name"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="md-content" className="block text-sm font-medium text-gray-700">
              Markdown Content
            </label>
            <textarea
              id="md-content"
              value={markdownContent}
              onChange={(e) => setMarkdownContent(e.target.value)}
              placeholder="Write your markdown here..."
              rows={10}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleMarkdownSubmit}
              disabled={uploading || !markdownName.trim() || !markdownContent.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? "Creating..." : "Create Document"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
