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

  /* Admin check for Header */
  const [isAdminUser, setIsAdminUser] = useState(false);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
    if (status === "authenticated") {
      fetch(apiUrl("/api/admin/check"))
        .then((r) => r.json())
        .then((d) => setIsAdminUser(d.isAdmin === true))
        .catch(() => {});
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
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <p style={{ color: 'var(--text-tertiary)' }}>Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <Header session={session} isAdmin={isAdminUser} />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            API Tokens
          </h1>
          {!showForm && !newToken && (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Generate Token
            </button>
          )}
        </div>

        {/* ---- New token display (shown once) ---- */}
        {newToken && (
          <div className="mb-6 rounded-lg p-4" style={{ border: '1px solid var(--warning)', backgroundColor: 'var(--warning-bg)', borderRadius: '4px' }}>
            <p className="mb-2 text-sm font-semibold" style={{ color: 'var(--warning)' }}>
              Save this token — it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-x-auto rounded px-3 py-2 text-sm font-mono" style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                {newToken}
              </code>
              <button
                onClick={copyToken}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setNewToken(null)}
              className="mt-3 text-sm underline hover:no-underline"
              style={{ color: 'var(--accent)' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---- Generate token form ---- */}
        {showForm && (
          <div className="mb-6 rounded-lg p-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              Token Name
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder="e.g. My CLI Token"
                className="flex-1 rounded-lg px-3 py-2 text-sm focus:outline-none"
                style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleGenerate();
                }}
                autoFocus
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !tokenName.trim()}
                className="shrink-0 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {generating ? "Generating..." : "Create"}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setTokenName("");
                }}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover-warm"
                style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ---- Token list ---- */}
        {loading ? (
          <p style={{ color: 'var(--text-tertiary)' }}>Loading tokens...</p>
        ) : tokens.length === 0 ? (
          <div className="rounded-lg p-8 text-center" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
            <p style={{ color: 'var(--text-tertiary)' }}>
              No API tokens yet. Generate one to get started.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
            <table className="min-w-full">
              <thead style={{ backgroundColor: 'var(--bg-sidebar)' }}>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => (
                  <tr key={token.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {token.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(token.createdAt).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm" style={{ color: 'var(--text-tertiary)' }}>
                      {token.lastUsedAt
                        ? new Date(token.lastUsedAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      {deletingId === token.id ? (
                        <span className="inline-flex items-center gap-2">
                          <span style={{ color: 'var(--text-tertiary)' }}>
                            Delete?
                          </span>
                          <button
                            onClick={() => handleDelete(token.id)}
                            className="font-medium"
                            style={{ color: 'var(--danger)' }}
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="font-medium"
                            style={{ color: 'var(--text-tertiary)' }}
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeletingId(token.id)}
                          className="font-medium"
                          style={{ color: 'var(--danger)' }}
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
