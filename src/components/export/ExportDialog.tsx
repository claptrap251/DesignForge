"use client";

import { useState, useEffect } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { apiUrl } from "@/lib/basePath";

interface ExportDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

type ExportFormat = "md" | "html" | "docx" | "confluence";

const FORMAT_OPTIONS: { value: ExportFormat; label: string; description: string }[] = [
  { value: "md", label: "Markdown", description: "Export as .md file with embedded comments" },
  { value: "html", label: "HTML", description: "Export as .html with rendered Mermaid diagrams (print to PDF from browser)" },
  { value: "docx", label: "Word", description: "Export as .docx document with diagram source code" },
  { value: "confluence", label: "Confluence", description: "Export as Confluence-compatible markup" },
];

export default function ExportDialog({ projectId, open, onClose }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("html");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copying" | "copied" | "error">("idle");

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const handleCopyConfluence = async () => {
    setCopyStatus("copying");
    try {
      const res = await fetch(apiUrl(`/api/export/${projectId}?format=confluence`));
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

  const handleExport = async () => {
    setExporting(true);
    setError(null);

    try {
      const res = await fetch(apiUrl(`/api/export/${projectId}?format=${format}`));

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Export failed");
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `export.${format === "confluence" ? "html" : format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+?)"?$/);
        if (match) filename = match[1];
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onClose();
    } catch (err: any) {
      setError(err.message || "Export failed");
    } finally {
      setExporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[calc(100%-2rem)] sm:max-w-md rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 p-4 sm:p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export Project</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-900/30 px-4 py-2 text-sm text-red-700 dark:text-red-400">{error}</div>
        )}

        <div className="mt-4 space-y-2">
          {FORMAT_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                format === opt.value
                  ? "border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-900/30"
                  : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <input
                type="radio"
                name="export-format"
                value={opt.value}
                checked={format === opt.value}
                onChange={() => setFormat(opt.value)}
                className="mt-0.5 h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">{opt.description}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {format === "confluence" && (
            <button
              onClick={handleCopyConfluence}
              disabled={copyStatus === "copying"}
              className="flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50"
            >
              {copyStatus === "copied" ? (
                "Copied!"
              ) : copyStatus === "error" ? (
                "Copy failed \u2014 try downloading"
              ) : copyStatus === "copying" ? (
                "Copying..."
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Markup
                </>
              )}
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
