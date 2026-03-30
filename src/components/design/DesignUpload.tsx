"use client";

import { useState, useRef, useCallback } from "react";
import { apiUrl } from "@/lib/basePath";

interface DesignUploadProps {
  folderId: string;
  onUploadComplete: () => void;
  onClose?: () => void;
}

type Tab = "image" | "upload-md" | "write-md";

export default function DesignUpload({ folderId, onUploadComplete, onClose }: DesignUploadProps) {
  const [activeTab, setActiveTab] = useState<Tab>("image");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mdFile, setMdFile] = useState<{ name: string; content: string } | null>(null);
  const [markdownName, setMarkdownName] = useState("");
  const [markdownContent, setMarkdownContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdFileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFile = useCallback((file: File) => {
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

  const handleMdFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".markdown") && file.type !== "text/markdown") {
      setError("Please select a Markdown (.md) file.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      setMdFile({
        name: file.name.replace(/\.(md|markdown)$/, ""),
        content: e.target?.result as string,
      });
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDropImage = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  };

  const handleDropMd = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleMdFileSelect(file);
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

      const res = await fetch(apiUrl("/api/designs"), { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
      onUploadComplete();
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleMdUpload = async () => {
    if (!mdFile) return;
    setUploading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/designs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, type: "markdown", name: mdFile.name, content: mdFile.content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }
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
      const res = await fetch(apiUrl("/api/designs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, type: "markdown", name: markdownName.trim(), content: markdownContent }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Creation failed");
      }
      onUploadComplete();
    } catch (err: any) {
      setError(err.message || "Creation failed");
    } finally {
      setUploading(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "image", label: "Upload Image" },
    { key: "upload-md", label: "Upload MD" },
    { key: "write-md", label: "Write Markdown" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl border p-6 shadow-xl" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Add Design</h3>
          {onClose && (
            <button onClick={onClose} className="rounded p-1" style={{ color: 'var(--text-tertiary)' }}>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="mb-4 flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'var(--bg-code)' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setError(null); }}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? "shadow-sm"
                  : ""
              }`}
              style={
                activeTab === t.key
                  ? { backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }
                  : { color: 'var(--text-tertiary)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "image" && (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDropImage}
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
              style={
                isDragging
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }
                  : { borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-sidebar)' }
              }
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
              ) : (
                <>
                  <svg className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drop an image or click to browse</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>PNG, JPG, GIF, SVG, WebP</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }} className="hidden" />
            {selectedFile && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm truncate mr-2" style={{ color: 'var(--text-secondary)' }}>{selectedFile.name}</span>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => { setSelectedFile(null); setPreview(null); }} className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}>
                    Clear
                  </button>
                  <button onClick={handleImageUpload} disabled={uploading} className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                    {uploading ? "Uploading..." : "Upload"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "upload-md" && (
          <div>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDropMd}
              onClick={() => mdFileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors"
              style={
                isDragging
                  ? { borderColor: 'var(--accent)', backgroundColor: 'var(--accent-bg)' }
                  : { borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-sidebar)' }
              }
            >
              {mdFile ? (
                <div className="text-center">
                  <svg className="mx-auto h-10 w-10" style={{ color: 'var(--accent)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{mdFile.name}.md</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{mdFile.content.length.toLocaleString()} characters</p>
                </div>
              ) : (
                <>
                  <svg className="h-10 w-10" style={{ color: 'var(--text-tertiary)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <p className="mt-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Drop a .md file or click to browse</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>.md, .markdown</p>
                </>
              )}
            </div>
            <input ref={mdFileInputRef} type="file" accept=".md,.markdown,text/markdown" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMdFileSelect(f); e.target.value = ""; }} className="hidden" />
            {mdFile && (
              <div className="mt-4 flex items-center justify-end gap-2">
                <button onClick={() => setMdFile(null)} className="rounded-lg border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--border-medium)', color: 'var(--text-secondary)' }}>
                  Clear
                </button>
                <button onClick={handleMdUpload} disabled={uploading} className="rounded-lg px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50" style={{ backgroundColor: 'var(--accent)' }}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === "write-md" && (
          <div className="space-y-4">
            <div>
              <label htmlFor="md-name" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Name</label>
              <input
                id="md-name" type="text" value={markdownName} onChange={(e) => setMarkdownName(e.target.value)}
                placeholder="Document name"
                className="mt-1 block w-full rounded-lg border px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:outline-none"
                style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
              />
            </div>
            <div>
              <label htmlFor="md-content" className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Content</label>
              <textarea
                id="md-content" value={markdownContent} onChange={(e) => setMarkdownContent(e.target.value)}
                placeholder="Write your markdown here..."
                rows={10}
                className="mt-1 block w-full rounded-lg border px-3 py-2 font-mono text-sm shadow-sm placeholder:text-gray-400 focus:outline-none"
                style={{ borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={handleMarkdownSubmit}
                disabled={uploading || !markdownName.trim() || !markdownContent.trim()}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {uploading ? "Creating..." : "Create Document"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
