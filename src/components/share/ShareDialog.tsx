"use client";

import { useState, useEffect } from "react";
import { copyToClipboard } from "@/lib/clipboard";
import { apiUrl } from "@/lib/basePath";

interface ShareLink {
  id: string;
  token: string;
  password: boolean;
  expiresAt: string | null;
  createdAt: string;
}

interface ShareDialogProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
}

export default function ShareDialog({ projectId, open, onClose }: ShareDialogProps) {
  const [links, setLinks] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [password, setPassword] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchLinks();
    }
  }, [open, projectId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const fetchLinks = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/projects/${projectId}/share`));
      if (res.ok) {
        const data = await res.json();
        setLinks(data);
      }
    } catch {
      setError("Failed to load share links");
    } finally {
      setLoading(false);
    }
  };

  const createLink = async () => {
    setCreating(true);
    setError(null);
    try {
      const body: any = {};
      if (password.trim()) body.password = password.trim();
      if (expiryDays && parseInt(expiryDays) > 0) body.expiryDays = parseInt(expiryDays);

      const res = await fetch(apiUrl(`/api/projects/${projectId}/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to create share link");

      setPassword("");
      setExpiryDays("");
      await fetchLinks();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteLink = async (linkId: string) => {
    try {
      await fetch(apiUrl(`/api/projects/${projectId}/share/${linkId}`), {
        method: "DELETE",
      });
      setLinks((prev) => prev.filter((l) => l.id !== linkId));
    } catch {
      setError("Failed to delete link");
    }
  };

  const copyLink = (token: string, id: string) => {
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const url = `${window.location.origin}${base}/share/${token}`;
    copyToClipboard(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-xl bg-white dark:bg-gray-800 dark:border-gray-700 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Share Project</h2>
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

        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Create New Link</h3>
          <div className="mt-2 space-y-2">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (optional)"
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                placeholder="Expiry (days, optional)"
                min="1"
                className="block flex-1 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={createLink}
                disabled={creating}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Link"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Existing Links</h3>
          {loading ? (
            <div className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">Loading...</div>
          ) : links.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No share links yet</div>
          ) : (
            <div className="mt-2 space-y-2">
              {links.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-mono text-gray-700 dark:text-gray-300">
                      /share/{link.token}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      {link.password && (
                        <span className="flex items-center gap-0.5">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          Protected
                        </span>
                      )}
                      {link.expiresAt && (
                        <span>
                          Expires{" "}
                          {new Date(link.expiresAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="ml-2 flex items-center gap-1">
                    <button
                      onClick={() => copyLink(link.token, link.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
                      title="Copy link"
                    >
                      {copiedId === link.id ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => deleteLink(link.id)}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      title="Delete link"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
