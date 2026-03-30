"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/basePath";
import Header from "@/components/layout/Header";
import ProjectCard from "@/components/project/ProjectCard";
import CreateProjectDialog from "@/components/project/CreateProjectDialog";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdminUser, setIsAdminUser] = useState(false);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/projects"));
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchProjects();
    }
  }, [status, router, fetchProjects]);

  useEffect(() => {
    fetch(apiUrl("/api/admin/check"))
      .then((r) => r.json())
      .then((d) => setIsAdminUser(d.isAdmin))
      .catch(() => {});
  }, []);

  const handleCreateProject = async (data: {
    name: string;
    description: string;
  }) => {
    const res = await fetch(apiUrl("/api/projects"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      setShowCreate(false);
      fetchProjects();
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
        <Header session={session} isAdmin={isAdminUser} />
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 rounded w-48" style={{ backgroundColor: 'var(--border-subtle)' }}></div>
            <div className="grid md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-40 rounded" style={{ backgroundColor: 'var(--border-subtle)' }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      <Header session={session} isAdmin={isAdminUser} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Projects</h2>
          {isAdminUser && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded text-sm font-medium transition flex items-center gap-2 text-white"
              style={{ backgroundColor: 'var(--accent)', borderRadius: '4px' }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Project
            </button>
          )}
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-20">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: 'var(--bg-code)' }}
            >
              <svg
                className="w-8 h-8"
                style={{ color: 'var(--text-tertiary)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              No projects yet
            </h3>
            <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>
              {isAdminUser
                ? "Create your first project to start collecting design feedback."
                : "No projects available. Ask your admin to create one."}
            </p>
            {isAdminUser && (
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 text-sm font-medium transition text-white"
                style={{ backgroundColor: 'var(--accent)', borderRadius: '4px' }}
              >
                Create Project
              </button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} isAdmin={isAdminUser} onDelete={fetchProjects} />
            ))}
          </div>
        )}
      </div>

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}
