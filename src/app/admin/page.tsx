"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

interface BackupConfig {
  configured: boolean;
  id?: string;
  apiUrl?: string;
  repo?: string;
  branch?: string;
  cron?: string;
  enabled?: boolean;
  tokenPreview?: string;
}

interface ScrapeTarget {
  id: string;
  name: string;
  githubType: string;
  githubName: string;
  apiUrl: string;
  tokenPreview: string;
  cronSchedule: string;
  enabled: boolean;
  projectId: string;
  project?: { id: string; name: string } | null;
  repos: ScrapeRepo[];
  runs: ScrapeRun[];
}

interface ScrapeRepo {
  id: string;
  repoFullName: string;
  branch: string;
  defaultBranch: string;
  enabled: boolean;
}

interface ScrapeRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  trigger: string;
  status: string;
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  error: string | null;
}

interface FetchedRepo {
  fullName: string;
  defaultBranch: string;
  mdFileCount: number;
  private: boolean;
}

interface Project {
  id: string;
  name: string;
  owner?: { username: string };
}

interface Message {
  type: "success" | "error";
  text: string;
}

/* ------------------------------------------------------------------ */
/*  Schedule presets                                                    */
/* ------------------------------------------------------------------ */

const SCHEDULE_PRESETS = [
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at 2 AM", value: "0 2 * * *" },
  { label: "Weekly (Sunday)", value: "0 2 * * 0" },
  { label: "Custom...", value: "custom" },
];

function presetForCron(cron: string): string {
  const found = SCHEDULE_PRESETS.find((p) => p.value === cron);
  return found ? cron : "custom";
}

/* ------------------------------------------------------------------ */
/*  Shared tiny components                                             */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 inline-block mr-1" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: "blue" | "purple" | "green" | "red" | "yellow" | "gray" }) {
  const colorStyles: Record<string, { backgroundColor: string; color: string }> = {
    blue: { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' },
    purple: { backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' },
    green: { backgroundColor: 'var(--success-bg)', color: 'var(--success)' },
    red: { backgroundColor: 'var(--danger-bg)', color: 'var(--danger)' },
    yellow: { backgroundColor: 'var(--warning-bg)', color: 'var(--warning)' },
    gray: { backgroundColor: 'var(--badge-draft-bg)', color: 'var(--badge-draft)' },
  };
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={colorStyles[color]}>
      {children}
    </span>
  );
}

function ScheduleDropdown({
  value,
  onChange,
  customValue,
  onCustomChange,
}: {
  value: string;
  onChange: (v: string) => void;
  customValue: string;
  onCustomChange: (v: string) => void;
}) {
  const selected = presetForCron(value);
  return (
    <div className="space-y-1">
      <select
        value={selected}
        onChange={(e) => {
          if (e.target.value === "custom") {
            onChange("custom");
          } else {
            onChange(e.target.value);
            onCustomChange(e.target.value);
          }
        }}
        className="w-full rounded-lg px-3 py-2 text-sm"
        style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
      >
        {SCHEDULE_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {selected === "custom" && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="0 */12 * * *"
          className="w-full rounded-lg px-3 py-2 text-sm font-mono"
          style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  /* ---- Top-level tab ---- */
  const [activeTab, setActiveTab] = useState<"backup" | "scraper">("backup");

  /* ---- Backup state ---- */
  const [config, setConfig] = useState<BackupConfig | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [restoreMode, setRestoreMode] = useState<"full" | "selective">("full");
  const [restoreProjects, setRestoreProjects] = useState<RestoreProject[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  /* Backup config form */
  const [cfgApiUrl, setCfgApiUrl] = useState("https://api.github.com");
  const [cfgRepo, setCfgRepo] = useState("");
  const [cfgBranch, setCfgBranch] = useState("main");
  const [cfgToken, setCfgToken] = useState("");
  const [cfgSchedule, setCfgSchedule] = useState("0 2 * * *");
  const [cfgCustomCron, setCfgCustomCron] = useState("0 2 * * *");
  const [cfgEnabled, setCfgEnabled] = useState(true);

  /* ---- Scraper state ---- */
  const [targets, setTargets] = useState<ScrapeTarget[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [addingTarget, setAddingTarget] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  /* Scraper target form */
  const [tName, setTName] = useState("");
  const [tType, setTType] = useState<"org" | "user">("org");
  const [tGhName, setTGhName] = useState("");
  const [tApiUrl, setTApiUrl] = useState("https://api.github.com");
  const [tToken, setTToken] = useState("");
  const [tProject, setTProject] = useState("");
  const [tSchedule, setTSchedule] = useState("0 */12 * * *");
  const [tCustomCron, setTCustomCron] = useState("0 */12 * * *");
  const [tEnabled, setTEnabled] = useState(true);

  /* Scraper repos */
  const [fetchedRepos, setFetchedRepos] = useState<FetchedRepo[]>([]);
  const [repoSelections, setRepoSelections] = useState<Record<string, { checked: boolean; branch: string; defaultBranch: string }>>({});
  const [branchCache, setBranchCache] = useState<Record<string, string[]>>({});
  const [loadingBranches, setLoadingBranches] = useState<Record<string, boolean>>({});

  /* Scraper history */
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeRun[]>([]);

  /* ---- Shared state ---- */
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [savingRepos, setSavingRepos] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  /* ---- Persist tab in hash ---- */
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "scraper") setActiveTab("scraper");
  }, []);

  useEffect(() => {
    window.location.hash = activeTab;
  }, [activeTab]);

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

  /* ---- Load backup config + history ---- */
  const loadBackupData = useCallback(async () => {
    try {
      const [cfgRes, histRes] = await Promise.all([
        fetch(apiUrl("/api/admin/config")),
        fetch(apiUrl("/api/admin/backup")),
      ]);
      if (cfgRes.ok) {
        const cfg: BackupConfig = await cfgRes.json();
        setConfig(cfg);
        if (cfg.configured) {
          setCfgApiUrl(cfg.apiUrl || "https://api.github.com");
          setCfgRepo(cfg.repo || "");
          setCfgBranch(cfg.branch || "main");
          setCfgSchedule(cfg.cron || "0 2 * * *");
          setCfgCustomCron(cfg.cron || "0 2 * * *");
          setCfgEnabled(cfg.enabled !== false);
          setCfgToken("");
        }
      }
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.history ?? []);
      }
    } catch {
      /* API may not exist yet */
    } finally {
      setDataLoaded(true);
    }
  }, []);

  /* ---- Load scraper targets ---- */
  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/admin/scraper/config"));
      if (res.ok) {
        const data: ScrapeTarget[] = await res.json();
        setTargets(data);
        if (data.length > 0 && !activeTargetId) {
          setActiveTargetId(data[0].id);
        }
      }
    } catch {
      /* graceful */
    }
  }, [activeTargetId]);

  /* ---- Load projects ---- */
  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/projects"));
      if (res.ok) setProjects(await res.json());
    } catch {
      /* graceful */
    }
  }, []);

  /* ---- Load scrape history for active target ---- */
  const loadScrapeHistory = useCallback(async (targetId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/admin/scraper/history?targetId=${targetId}`));
      if (res.ok) setScrapeHistory(await res.json());
    } catch {
      /* graceful */
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") {
      loadBackupData();
      loadTargets();
      loadProjects();
    }
  }, [status, loadBackupData, loadTargets, loadProjects]);

  useEffect(() => {
    if (activeTargetId) loadScrapeHistory(activeTargetId);
  }, [activeTargetId, loadScrapeHistory]);

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

  /* ---------------------------------------------------------------- */
  /*  Backup actions                                                   */
  /* ---------------------------------------------------------------- */

  const saveBackupConfig = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const cronValue = cfgSchedule === "custom" ? cfgCustomCron : cfgSchedule;
      const res = await fetch(apiUrl("/api/admin/config"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiUrl: cfgApiUrl,
          repo: cfgRepo,
          branch: cfgBranch,
          cronSchedule: cronValue,
          enabled: cfgEnabled,
          ...(cfgToken ? { token: cfgToken } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: "Backup configuration saved." });
        loadBackupData();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to save config" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  };

  const runBackup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/admin/backup"), { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setMessage({ type: "success", text: `Backup complete -- ${data.fileCount ?? 0} files, ${data.stats?.projects ?? 0} projects, ${data.stats?.designs ?? 0} designs` });
        loadBackupData();
      } else {
        setMessage({ type: "error", text: data.error || "Backup failed" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Backup request failed" });
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
        setMessage({ type: "success", text: `Restore complete -- ${data.projects ?? 0} projects restored` });
      } else {
        setMessage({ type: "error", text: data.error || "Restore failed" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Restore request failed" });
    } finally {
      setBusy(false);
    }
  };

  const toggleProject = (id: string) =>
    setSelectedProjects((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );

  /* ---------------------------------------------------------------- */
  /*  Scraper actions                                                  */
  /* ---------------------------------------------------------------- */

  const activeTarget = targets.find((t) => t.id === activeTargetId) ?? null;

  /* Populate form when switching targets */
  useEffect(() => {
    if (activeTarget && !addingTarget) {
      setTName(activeTarget.name);
      setTType(activeTarget.githubType as "org" | "user");
      setTGhName(activeTarget.githubName);
      setTApiUrl(activeTarget.apiUrl);
      setTToken("");
      setTProject(activeTarget.projectId);
      setTSchedule(activeTarget.cronSchedule);
      setTCustomCron(activeTarget.cronSchedule);
      setTEnabled(activeTarget.enabled);
      setFetchedRepos([]);
      // Build selections from saved repos
      const sels: typeof repoSelections = {};
      for (const r of activeTarget.repos) {
        sels[r.repoFullName] = { checked: r.enabled, branch: r.branch, defaultBranch: r.defaultBranch };
      }
      setRepoSelections(sels);
    }
  }, [activeTarget?.id, addingTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetTargetForm = () => {
    setTName("");
    setTType("org");
    setTGhName("");
    setTApiUrl("https://api.github.com");
    setTToken("");
    setTProject("");
    setTSchedule("0 */12 * * *");
    setTCustomCron("0 */12 * * *");
    setTEnabled(true);
    setFetchedRepos([]);
    setRepoSelections({});
  };

  const saveTarget = async () => {
    setBusy(true);
    setMessage(null);
    const cronValue = tSchedule === "custom" ? tCustomCron : tSchedule;
    try {
      if (addingTarget) {
        const res = await fetch(apiUrl("/api/admin/scraper/config"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tName || tGhName,
            githubType: tType,
            githubName: tGhName,
            apiUrl: tApiUrl,
            token: tToken,
            cronSchedule: cronValue,
            projectId: tProject,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "Target created." });
          setAddingTarget(false);
          await loadTargets();
          setActiveTargetId(data.id);
        } else {
          setMessage({ type: "error", text: data.error || "Failed to create target" });
        }
      } else if (activeTargetId) {
        const res = await fetch(apiUrl(`/api/admin/scraper/config/${activeTargetId}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: tName,
            githubType: tType,
            githubName: tGhName,
            apiUrl: tApiUrl,
            ...(tToken ? { token: tToken } : {}),
            cronSchedule: cronValue,
            enabled: tEnabled,
            projectId: tProject,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          setMessage({ type: "success", text: "Target updated." });
          loadTargets();
        } else {
          setMessage({ type: "error", text: data.error || "Failed to update target" });
        }
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  };

  const deleteTarget = async () => {
    if (!activeTargetId) return;
    if (!confirm("Delete this target and all its repos/history? This cannot be undone.")) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl(`/api/admin/scraper/config/${activeTargetId}`), { method: "DELETE" });
      if (res.ok) {
        setMessage({ type: "success", text: "Target deleted." });
        setActiveTargetId(null);
        loadTargets();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to delete" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  };

  const fetchRepos = async () => {
    if (!activeTargetId) return;
    setLoadingRepos(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/admin/scraper/repos"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: activeTargetId }),
      });
      if (res.ok) {
        const repos: FetchedRepo[] = await res.json();
        setFetchedRepos(repos);
        // Merge with existing selections
        const sels = { ...repoSelections };
        for (const r of repos) {
          if (!sels[r.fullName]) {
            sels[r.fullName] = { checked: false, branch: r.defaultBranch, defaultBranch: r.defaultBranch };
          }
        }
        setRepoSelections(sels);
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to fetch repos" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setLoadingRepos(false);
    }
  };

  const saveRepoSelections = async () => {
    if (!activeTargetId) return;
    setSavingRepos(true);
    setMessage(null);
    try {
      const repos = Object.entries(repoSelections).map(([name, sel]) => ({
        repoFullName: name,
        branch: sel.branch,
        defaultBranch: sel.defaultBranch,
        enabled: sel.checked,
      }));
      const res = await fetch(apiUrl("/api/admin/scraper/repos"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: activeTargetId, repos }),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Repo selections saved." });
        loadTargets();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error || "Failed to save" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setSavingRepos(false);
    }
  };

  const fetchBranches = useCallback(async (repoFullName: string) => {
    if (!activeTargetId || branchCache[repoFullName]) return;
    setLoadingBranches((prev) => ({ ...prev, [repoFullName]: true }));
    try {
      const encoded = encodeURIComponent(repoFullName);
      const res = await fetch(apiUrl(`/api/admin/scraper/branches/${encoded}?targetId=${activeTargetId}`));
      if (res.ok) {
        const branches: string[] = await res.json();
        setBranchCache((prev) => ({ ...prev, [repoFullName]: branches }));
      }
    } catch {
      /* graceful */
    } finally {
      setLoadingBranches((prev) => ({ ...prev, [repoFullName]: false }));
    }
  }, [activeTargetId, branchCache]);

  const runScrape = async () => {
    if (!activeTargetId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(apiUrl("/api/admin/scraper/run"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId: activeTargetId }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: data.status === "success" ? "success" : "error",
          text: data.status === "success"
            ? `Scrape complete -- ${data.filesCreated ?? 0} created, ${data.filesUpdated ?? 0} updated`
            : (data.error || "Scrape failed"),
        });
        loadScrapeHistory(activeTargetId);
      } else {
        setMessage({ type: "error", text: data.error || "Scrape failed" });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  };

  /* ---- Toggle repo check and lazy-load branches ---- */
  const toggleRepoCheck = (fullName: string, defaultBranch: string) => {
    setRepoSelections((prev) => {
      const existing = prev[fullName];
      const newChecked = !(existing?.checked);
      if (newChecked) fetchBranches(fullName);
      return {
        ...prev,
        [fullName]: {
          checked: newChecked,
          branch: existing?.branch || defaultBranch,
          defaultBranch,
        },
      };
    });
  };

  /* ---- Group restore projects by owner ---- */
  const grouped = restoreProjects.reduce<Record<string, RestoreProject[]>>((acc, p) => {
    (acc[p.owner] ??= []).push(p);
    return acc;
  }, {});

  /* ---- Derived: all fetched repo names ---- */
  const allRepoNames = fetchedRepos.map((r) => r.fullName);
  const checkedCount = Object.values(repoSelections).filter((s) => s.checked).length;

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  /* ---- Loading state ---- */
  if (status === "loading" || !dataLoaded) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <Header session={session} isAdmin />
        <div className="max-w-5xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 rounded w-48" style={{ backgroundColor: 'var(--border-subtle)' }} />
            <div className="h-40 rounded-lg" style={{ backgroundColor: 'var(--border-subtle)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <Header session={session} isAdmin />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin</h1>

        {/* ---- Message banner ---- */}
        {message && (
          <div
            className="rounded-lg p-4 text-sm font-medium"
            style={{
              backgroundColor: message.type === "success" ? 'var(--success-bg)' : 'var(--danger-bg)',
              color: message.type === "success" ? 'var(--success)' : 'var(--danger)',
              borderRadius: '4px',
            }}
          >
            {message.text}
          </div>
        )}

        {/* ---- Tab navigation ---- */}
        <div className="flex border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <button
            onClick={() => { setActiveTab("backup"); setMessage(null); }}
            className="px-4 py-2 text-sm font-medium border-b-2 transition"
            style={{
              borderColor: activeTab === "backup" ? 'var(--accent)' : 'transparent',
              color: activeTab === "backup" ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            Backup
          </button>
          <button
            onClick={() => { setActiveTab("scraper"); setMessage(null); }}
            className="px-4 py-2 text-sm font-medium border-b-2 transition"
            style={{
              borderColor: activeTab === "scraper" ? 'var(--accent)' : 'transparent',
              color: activeTab === "scraper" ? 'var(--text-primary)' : 'var(--text-tertiary)',
            }}
          >
            GitHub Scraper
          </button>
        </div>

        {/* ================================================================ */}
        {/*  BACKUP TAB                                                      */}
        {/* ================================================================ */}
        {activeTab === "backup" && (
          <div className="space-y-6">
            {/* ---- Config form ---- */}
            <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Configuration</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API URL</label>
                  <input
                    type="text"
                    value={cfgApiUrl}
                    onChange={(e) => setCfgApiUrl(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Repository</label>
                  <input
                    type="text"
                    value={cfgRepo}
                    onChange={(e) => setCfgRepo(e.target.value)}
                    placeholder="owner/repo"
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Branch</label>
                  <input
                    type="text"
                    value={cfgBranch}
                    onChange={(e) => setCfgBranch(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Token {config?.configured && <span style={{ color: 'var(--text-tertiary)' }} className="font-normal">({config?.tokenPreview})</span>}
                  </label>
                  <input
                    type="password"
                    value={cfgToken}
                    onChange={(e) => setCfgToken(e.target.value)}
                    placeholder={config?.configured ? "Leave empty to keep current" : "ghp_..."}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                    style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule</label>
                  <ScheduleDropdown
                    value={cfgSchedule}
                    onChange={setCfgSchedule}
                    customValue={cfgCustomCron}
                    onCustomChange={setCfgCustomCron}
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfgEnabled}
                      onChange={(e) => setCfgEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" style={{ backgroundColor: cfgEnabled ? 'var(--success)' : 'var(--badge-draft)' }} />
                  </label>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enabled</span>
                </div>
              </div>
              <button
                onClick={saveBackupConfig}
                disabled={busy || !cfgRepo}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {busy ? <><Spinner /> Saving...</> : "Save Configuration"}
              </button>
            </div>

            {/* ---- Two-column: Backup + Restore ---- */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* ---- Left: Backup ---- */}
              <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Backup</h2>

                <button
                  onClick={runBackup}
                  disabled={busy || !config?.configured}
                  className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {busy ? <><Spinner /> Running...</> : "Run Backup Now"}
                </button>

                {history.length > 0 ? (
                  <ul className="max-h-72 overflow-y-auto" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                    {history.map((h, i) => (
                      <li key={i} className="py-2 flex items-center justify-between text-sm" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-2">
                          <Badge color={h.trigger === "auto" ? "blue" : "yellow"}>{h.trigger}</Badge>
                          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                            {h.projects}p / {h.images}i
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No backup history yet.</p>
                )}
              </div>

              {/* ---- Right: Restore ---- */}
              <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Restore</h2>

                {/* Mode toggle */}
                <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  <button
                    onClick={() => setRestoreMode("full")}
                    className="flex-1 px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      backgroundColor: restoreMode === "full" ? 'var(--accent)' : 'var(--bg-page)',
                      color: restoreMode === "full" ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    Full
                  </button>
                  <button
                    onClick={() => setRestoreMode("selective")}
                    className="flex-1 px-3 py-1.5 text-sm font-medium transition"
                    style={{
                      backgroundColor: restoreMode === "selective" ? 'var(--accent)' : 'var(--bg-page)',
                      color: restoreMode === "selective" ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    Selective
                  </button>
                </div>

                {/* Full mode warning */}
                {restoreMode === "full" && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: '4px' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--danger)' }}>
                      Full restore replaces <strong>all</strong> existing projects and images. This action is destructive and cannot be undone.
                    </p>
                  </div>
                )}

                {/* Selective mode -- project picker */}
                {restoreMode === "selective" && (
                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {loadingPreview ? (
                      <p className="text-sm animate-pulse" style={{ color: 'var(--text-tertiary)' }}>Loading projects...</p>
                    ) : Object.keys(grouped).length === 0 ? (
                      <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No projects found in backup.</p>
                    ) : (
                      Object.entries(grouped).map(([owner, prjs]) => (
                        <div key={owner}>
                          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: 'var(--text-tertiary)' }}>
                            {owner}
                          </p>
                          {prjs.map((p) => (
                            <label
                              key={p.path}
                              className="flex items-center gap-2 py-1 text-sm cursor-pointer"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <input
                                type="checkbox"
                                checked={selectedProjects.includes(p.path)}
                                onChange={() => toggleProject(p.path)}
                                className="rounded"
                                style={{ accentColor: 'var(--accent)' }}
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
                    !config?.configured ||
                    (restoreMode === "selective" && selectedProjects.length === 0)
                  }
                  className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {busy ? <><Spinner /> Restoring...</> : restoreMode === "full" ? "Restore All" : `Restore ${selectedProjects.length} Selected`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/*  SCRAPER TAB                                                     */}
        {/* ================================================================ */}
        {activeTab === "scraper" && (
          <div className="space-y-6">
            {/* ---- Target tabs ---- */}
            <div className="flex flex-wrap items-center gap-2 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {targets.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setActiveTargetId(t.id); setAddingTarget(false); setMessage(null); }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  style={{
                    backgroundColor: activeTargetId === t.id && !addingTarget ? 'var(--accent)' : 'var(--bg-code)',
                    color: activeTargetId === t.id && !addingTarget ? 'white' : 'var(--text-secondary)',
                  }}
                >
                  {t.name}
                  {!t.enabled && <span className="ml-1 text-xs opacity-60">(off)</span>}
                </button>
              ))}
              <button
                onClick={() => {
                  setAddingTarget(true);
                  resetTargetForm();
                  setMessage(null);
                }}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition"
                style={{
                  backgroundColor: addingTarget ? 'var(--accent)' : 'var(--bg-code)',
                  color: addingTarget ? 'white' : 'var(--text-secondary)',
                }}
              >
                + Add Target
              </button>
            </div>

            {/* ---- No targets empty state ---- */}
            {targets.length === 0 && !addingTarget && (
              <div className="rounded-lg p-8 text-center" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <p className="mb-4" style={{ color: 'var(--text-tertiary)' }}>No scrape targets configured yet.</p>
                <button
                  onClick={() => { setAddingTarget(true); resetTargetForm(); }}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  + Add Your First Target
                </button>
              </div>
            )}

            {/* ---- Target config panel ---- */}
            {(activeTarget || addingTarget) && (
              <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  {addingTarget ? "New Target" : "Target Configuration"}
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                    <input
                      type="text"
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      placeholder="My Org"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <select
                      value={tType}
                      onChange={(e) => setTType(e.target.value as "org" | "user")}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      <option value="org">Organization</option>
                      <option value="user">User</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>GitHub Name</label>
                    <input
                      type="text"
                      value={tGhName}
                      onChange={(e) => setTGhName(e.target.value)}
                      placeholder="my-org"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>API URL</label>
                    <input
                      type="text"
                      value={tApiUrl}
                      onChange={(e) => setTApiUrl(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Token {!addingTarget && activeTarget && <span className="font-normal" style={{ color: 'var(--text-tertiary)' }}>({activeTarget.tokenPreview})</span>}
                    </label>
                    <input
                      type="password"
                      value={tToken}
                      onChange={(e) => setTToken(e.target.value)}
                      placeholder={addingTarget ? "ghp_..." : "Leave empty to keep current"}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Project</label>
                    <select
                      value={tProject}
                      onChange={(e) => setTProject(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                    >
                      <option value="">Select project...</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.owner ? ` (${p.owner.username})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule</label>
                    <ScheduleDropdown
                      value={tSchedule}
                      onChange={setTSchedule}
                      customValue={tCustomCron}
                      onCustomChange={setTCustomCron}
                    />
                  </div>
                  {!addingTarget && (
                    <div className="flex items-center gap-3 pt-6">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tEnabled}
                          onChange={(e) => setTEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 rounded-full transition after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" style={{ backgroundColor: tEnabled ? 'var(--success)' : 'var(--badge-draft)' }} />
                      </label>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enabled</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={saveTarget}
                    disabled={busy || !tGhName || (!addingTarget ? false : !tToken || !tProject)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {busy ? <><Spinner /> Saving...</> : addingTarget ? "Create Target" : "Save"}
                  </button>
                  {!addingTarget && (
                    <>
                      <button
                        onClick={fetchRepos}
                        disabled={loadingRepos}
                        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                        style={{ border: '1px solid var(--border-medium)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-page)' }}
                      >
                        {loadingRepos ? <><Spinner /> Fetching...</> : "Fetch Repos"}
                      </button>
                      <button
                        onClick={deleteTarget}
                        disabled={busy}
                        className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition ml-auto"
                        style={{ backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                      >
                        Delete
                      </button>
                    </>
                  )}
                  {addingTarget && (
                    <button
                      onClick={() => { setAddingTarget(false); setMessage(null); }}
                      className="rounded-lg px-4 py-2 text-sm font-medium transition"
                      style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-secondary)' }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ---- Repo checklist ---- */}
            {!addingTarget && activeTarget && (fetchedRepos.length > 0 || activeTarget.repos.length > 0) && (
              <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Repositories {checkedCount > 0 && `(${checkedCount} selected)`}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const all: typeof repoSelections = {};
                        const names = fetchedRepos.length > 0 ? allRepoNames : Object.keys(repoSelections);
                        names.forEach((n) => {
                          const existing = repoSelections[n];
                          const defaultBr = fetchedRepos.find((r) => r.fullName === n)?.defaultBranch || existing?.defaultBranch || "main";
                          all[n] = { checked: true, branch: existing?.branch || defaultBr, defaultBranch: defaultBr };
                          fetchBranches(n);
                        });
                        setRepoSelections(all);
                      }}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => {
                        setRepoSelections((prev) => {
                          const next: typeof prev = {};
                          for (const [k, v] of Object.entries(prev)) {
                            next[k] = { ...v, checked: false };
                          }
                          return next;
                        });
                      }}
                      className="text-xs hover:underline"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {(fetchedRepos.length > 0 ? fetchedRepos : activeTarget.repos.map((r) => ({
                    fullName: r.repoFullName,
                    defaultBranch: r.defaultBranch,
                    mdFileCount: 0,
                    private: false,
                  }))).map((repo) => {
                    const sel = repoSelections[repo.fullName];
                    const checked = sel?.checked ?? false;
                    const branches = branchCache[repo.fullName];
                    const loading = loadingBranches[repo.fullName];

                    return (
                      <div key={repo.fullName} className="py-2 flex items-center gap-3 text-sm" style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: checked ? 'var(--success-bg)' : 'transparent' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRepoCheck(repo.fullName, repo.defaultBranch)}
                          className="rounded"
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span className="flex-1 font-mono text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                          {repo.fullName}
                        </span>
                        {fetchedRepos.length > 0 && (
                          <span className="text-xs shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                            {repo.mdFileCount} .md
                          </span>
                        )}
                        {checked && (
                          loading ? (
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}><Spinner /> branches</span>
                          ) : branches ? (
                            <select
                              value={sel?.branch || repo.defaultBranch}
                              onChange={(e) => {
                                setRepoSelections((prev) => ({
                                  ...prev,
                                  [repo.fullName]: { ...prev[repo.fullName], branch: e.target.value },
                                }));
                              }}
                              className="rounded text-xs px-2 py-1"
                              style={{ borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--border-medium)', backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', borderRadius: '4px' }}
                            >
                              {branches.map((b) => (
                                <option key={b} value={b}>{b}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{sel?.branch || repo.defaultBranch}</span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={saveRepoSelections}
                  disabled={savingRepos}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {savingRepos ? <><Spinner /> Saving...</> : "Save Selections"}
                </button>
              </div>
            )}

            {/* ---- Scrape history ---- */}
            {!addingTarget && activeTarget && (
              <div className="rounded-lg p-5 space-y-4" style={{ border: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)', borderRadius: '4px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Scrape History</h2>
                  <button
                    onClick={runScrape}
                    disabled={busy}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    {busy ? <><Spinner /> Running...</> : "Run Now"}
                  </button>
                </div>

                {scrapeHistory.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-xs uppercase" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-subtle)' }}>
                          <th className="py-2 pr-3">Timestamp</th>
                          <th className="py-2 pr-3">Trigger</th>
                          <th className="py-2 pr-3">Result</th>
                          <th className="py-2 pr-3">Files</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scrapeHistory.map((run) => (
                          <tr key={run.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td className="py-2 pr-3 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                              {new Date(run.startedAt).toLocaleString()}
                            </td>
                            <td className="py-2 pr-3">
                              <Badge color={run.trigger === "auto" ? "blue" : "yellow"}>{run.trigger}</Badge>
                            </td>
                            <td className="py-2 pr-3">
                              <Badge color={run.status === "success" ? "green" : run.status === "running" ? "yellow" : "red"}>
                                {run.status}
                              </Badge>
                              {run.error && (
                                <span className="block text-xs mt-0.5 truncate max-w-xs" style={{ color: 'var(--danger)' }}>{run.error}</span>
                              )}
                            </td>
                            <td className="py-2 pr-3 text-xs whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                              +{run.filesCreated} / ~{run.filesUpdated} / -{run.filesDeleted}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No scrape runs yet.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
