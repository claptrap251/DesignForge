"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";

interface BackupHistoryEntry {
  timestamp: string;
  trigger: "auto" | "manual";
  projects: number;
  images: number;
  versions: number;
}

interface RestoreProject {
  path: string;
  name: string;
  owner: string;
}

interface Config {
  configured: boolean;
  apiUrl?: string;
  repo?: string;
  branch?: string;
  cron?: string;
  tokenPreview?: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [config, setConfig] = useState<Config | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [restoreMode, setRestoreMode] = useState<"full" | "selective">("full");
  const [restoreProjects, setRestoreProjects] = useState<RestoreProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  /* ---- Auth guard ---- */
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    if (status === "authenticated") {
      fetch(apiUrl("/api/admin/check"))
        .then((r) => r.json())
        .then((d) => {
          if (!d.isAdmin) router.push("/dashboard");
        })
        .catch(() => router.push("/dashboard"));
    }
  }, [status, router]);

  /* ---- Load config + history ---- */
  const loadData = useCallback(async () => {
    try {
      const [cfgRes, histRes] = await Promise.all([
        fetch(apiUrl("/api/admin/config")),
        fetch(apiUrl("/api/admin/backup")),
      ]);
      if (cfgRes.ok) setConfig(await cfgRes.json());
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history ?? []);
      }
    } catch {
      /* API may not exist yet */
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") loadData();
  }, [status, loadData]);

  /* ---- Restore preview ---- */
  const loadPreview = useCallback(async () => {
    setLoadingPreview(true);
    try {
      const res = await fetch(apiUrl("/api/admin/restore/preview"));
      if (res.ok) {
        const data = await res.json();
        setRestoreProjects(data.projects ?? []);
      }
    } catch {
      /* graceful */
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (restoreMode === "selective") loadPreview();
  }, [restoreMode, loadPreview]);

  /* ---- Actions ---- */
  const runBackup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/admin/backup"), { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setMessage({ type: "success", text: `Backup complete — ${data.fileCount ?? 0} files, ${data.stats?.projects ?? 0} projects, ${data.stats?.designs ?? 0} designs` });
        loadData();
      } else {
        setMessage({ type: "error", text: data.error || "Backup failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Backup request failed" });
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (restoreMode === "full") {
      if (!confirm("Full restore will REPLACE all existing data. This cannot be undone. Continue?")) return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/admin/restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: restoreMode,
          projects: restoreMode === "selective" ? selectedProjects : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `Restore complete — ${data.projects ?? 0} projects restored` });
      } else {
        setMessage({ type: "error", text: data.error || "Restore failed" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Restore request failed" });
    } finally {
      setBusy(false);
    }
  };

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  /* ---- Group projects by owner ---- */
  const grouped = restoreProjects.reduce<Record<string, RestoreProject[]>>((acc, p) => {
    (acc[p.owner] ??= []).push(p);
    return acc;
  }, {});

  /* ---- Loading state ---- */
  if (status === "loading" || !config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header session={session} isAdmin />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-48" />
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  const lastBackup = history[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header session={session} isAdmin />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Admin — Backup &amp; Restore</h1>

        {/* ---- Message banner ---- */}
        {message && (
          <div
            className={`rounded-lg p-4 text-sm font-medium ${
              message.type === "success"
                ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-900/30 dark:text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* ---- Status banner ---- */}
        {config.configured ? (
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <p className="text-sm font-medium text-green-800 dark:text-green-300">
              Backup configured
              {lastBackup && (
                <> — last backup {new Date(lastBackup.timestamp).toLocaleString()} ({lastBackup.projects} projects, {lastBackup.images} images)</>
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300">
              Backup not configured — set <code className="font-mono text-xs">GITHUB_BACKUP_*</code> environment variables to enable.
            </p>
          </div>
        )}

        {/* ---- Config display ---- */}
        {config.configured && (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3">
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Configuration</h2>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div>
                <dt className="text-gray-500 dark:text-gray-400">GitHub API</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100 truncate">{config.apiUrl}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Repository</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.repo}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Branch</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.branch}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Cron</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.cron || "—"}</dd>
              </div>
              <div>
                <dt className="text-gray-500 dark:text-gray-400">Token</dt>
                <dd className="font-mono text-gray-900 dark:text-gray-100">{config.tokenPreview}</dd>
              </div>
            </dl>
          </div>
        )}

        {/* ---- Two-column layout ---- */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* ---- Left: Backup ---- */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Backup</h2>

            <button
              onClick={runBackup}
              disabled={busy || !config.configured}
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Running…" : "Run Backup Now"}
            </button>

            {history.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-72 overflow-y-auto">
                {history.map((h, i) => (
                  <li key={i} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">
                      {new Date(h.timestamp).toLocaleString()}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          h.trigger === "auto"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        }`}
                      >
                        {h.trigger}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {h.projects}p / {h.images}i
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">No backup history yet.</p>
            )}
          </div>

          {/* ---- Right: Restore ---- */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4">
            <h2 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Restore</h2>

            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                onClick={() => setRestoreMode("full")}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition ${
                  restoreMode === "full"
                    ? "bg-orange-500 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Full
              </button>
              <button
                onClick={() => setRestoreMode("selective")}
                className={`flex-1 px-3 py-1.5 text-sm font-medium transition ${
                  restoreMode === "selective"
                    ? "bg-orange-500 text-white"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                Selective
              </button>
            </div>

            {/* Full mode warning */}
            {restoreMode === "full" && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-300">
                  Full restore replaces <strong>all</strong> existing projects and images. This action is destructive and cannot be undone.
                </p>
              </div>
            )}

            {/* Selective mode — project picker */}
            {restoreMode === "selective" && (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {loadingPreview ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">Loading projects…</p>
                ) : Object.keys(grouped).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No projects found in backup.</p>
                ) : (
                  Object.entries(grouped).map(([owner, projects]) => (
                    <div key={owner}>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                        {owner}
                      </p>
                      {projects.map((p) => (
                        <label
                          key={p.path}
                          className="flex items-center gap-2 py-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProjects.includes(p.path)}
                            onChange={() => toggleProject(p.path)}
                            className="rounded border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500"
                          />
                          <span>{p.name}</span>
                        </label>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            <button
              onClick={runRestore}
              disabled={
                busy ||
                !config.configured ||
                (restoreMode === "selective" && selectedProjects.length === 0)
              }
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {busy ? "Restoring…" : restoreMode === "full" ? "Restore All" : `Restore ${selectedProjects.length} Selected`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
