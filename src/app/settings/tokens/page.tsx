"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ApiToken {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function TokensPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);

  /* Generate-token form */
  const [showForm, setShowForm] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [generating, setGenerating] = useState(false);

  /* Newly created token (shown once) */
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  /* Delete confirmation */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  /* ---- Fetch tokens ---- */
  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/tokens"));
      if (res.ok) {
        const data = await res.json();
        setTokens(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      fetchTokens();
    }
  }, [status, fetchTokens]);

  /* ---- Generate token ---- */
  const handleGenerate = useCallback(async () => {
    if (!tokenName.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch(apiUrl("/api/tokens"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tokenName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setCopied(false);
        setTokenName("");
        setShowForm(false);
        fetchTokens();
      }
    } finally {
      setGenerating(false);
    }
  }, [tokenName, fetchTokens]);

  /* ---- Delete token ---- */
  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(apiUrl(`/api/tokens/${id}`), {
        method: "DELETE",
      });
      if (res.ok) {
        setTokens((prev) => prev.filter((t) => t.id !== id));
        setDeletingId(null);
      }
    },
    []
  );

  /* ---- Copy to clipboard ---- */
  const copyToken = useCallback(() => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
    }
  }, [newToken]);

  /* ---- Loading / auth states ---- */
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header session={session} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            API Tokens
          </h1>
          {!showForm && !newToken && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Generate Token
            </button>
          )}
        </div>

        {/* ---- New token display (shown once) ---- */}
        {newToken && (
          <div className="mb-6 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30 p-4">
            <p className="mb-2 text-sm font-semibold text-green-800 dark:text-green-300">
              Save this token — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 font-mono">
                {newToken}
              </code>
              <button
                onClick={copyToken}
                className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="mt-3 text-sm text-green-700 dark:text-green-400 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---- Generate token form ---- */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Token Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. My CLI Token"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
                autoFocus
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !tokenName.trim()}
                className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {generating ? "Generating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setTokenName("");
                }}
                className="shrink-0 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- Token list ---- */}
        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading tokens...</p>
        ) : tokens.length === 0 ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              No API tokens yet. Generate one to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {tokens.map((token) => (
                  <tr key={token.id}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                      {token.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {token.lastUsedAt
                        ? new Date(token.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      {deletingId === token.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(token.id)}
                            className="font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeletingId(token.id)}
                          className="font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
