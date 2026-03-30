"use client";

import { useState, useEffect } from "react";
import { apiUrl, navUrl } from "@/lib/basePath";

interface RelatedDesignsProps {
  designId: string;
  projectId: string;
}

interface FolderPathEntry {
  id: string;
  name: string;
}

interface Relationship {
  docAId: string;
  docBId: string;
  docAName: string;
  docBName: string;
  score: number;
  docScore: number;
  chunkScore: number;
  bestChunkA: string;
  bestChunkB: string;
  sharedTerms: string[];
  docAOwner?: string;
  docBOwner?: string;
  docAFolderPath?: FolderPathEntry[];
  docBFolderPath?: FolderPathEntry[];
}

export default function RelatedDesigns({ designId, projectId }: RelatedDesignsProps) {
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchRelationships() {
      try {
        const res = await fetch(
          apiUrl(`/api/projects/${projectId}/relationships?designId=${designId}`)
        );
        if (res.ok && !cancelled) {
          const data = await res.json();
          setRelationships(data.relationships || []);
        }
      } catch {
        // Silently fail — not critical
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchRelationships();
    return () => { cancelled = true; };
  }, [designId, projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: 'var(--accent)' }}></div>
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="py-8 text-center">
        <svg
          className="mx-auto h-8 w-8"
          style={{ color: 'var(--text-tertiary)' }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.07-9.07a4.5 4.5 0 016.364 6.364l-4.5 4.5a4.5 4.5 0 01-7.244-1.242"
          />
        </svg>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>No related designs found</p>
        <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Similarity is computed from shared terminology across markdown designs in this project.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {relationships.map((rel) => {
        const isA = rel.docAId === designId;
        const relatedId = isA ? rel.docBId : rel.docAId;
        const relatedName = isA ? rel.docBName : rel.docAName;
        const relatedFolderPath = isA ? rel.docBFolderPath : rel.docAFolderPath;
        const bestChunk = isA ? rel.bestChunkB : rel.bestChunkA;
        const myChunk = isA ? rel.bestChunkA : rel.bestChunkB;
        const percent = Math.round(rel.score * 100);

        const barColor =
          percent >= 70
            ? 'var(--warning)'
            : percent >= 30
            ? 'var(--accent)'
            : 'var(--text-tertiary)';

        const badgeBg =
          percent >= 70
            ? 'var(--warning-bg)'
            : percent >= 30
            ? 'var(--accent-bg)'
            : 'var(--bg-code)';

        const badgeColor =
          percent >= 70
            ? 'var(--warning)'
            : percent >= 30
            ? 'var(--accent)'
            : 'var(--text-tertiary)';

        return (
          <a
            key={relatedId}
            href={navUrl(`/project/${projectId}/design/${relatedId}`)}
            className="block p-3 transition-all"
            style={{ border: '1px solid var(--border-subtle)', borderRadius: '4px', backgroundColor: 'var(--bg-page)' }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {relatedFolderPath && relatedFolderPath.length > 0 && (
                  <p className="text-xs truncate mb-0.5" style={{ color: 'var(--text-tertiary)' }}>
                    {relatedFolderPath.map((f, i) => (
                      <span key={f.id}>
                        {i > 0 && <span className="mx-0.5">/</span>}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            window.location.href = navUrl(`/project/${projectId}?folder=${f.id}`);
                          }}
                          className="hover:underline"
                          style={{ color: 'var(--text-tertiary)' }}
                          onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent)')}
                          onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                        >
                          {f.name}
                        </button>
                      </span>
                    ))}
                  </p>
                )}
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {relatedName}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: badgeBg, color: badgeColor }}
              >
                {percent}%
              </span>
            </div>

            {/* Similarity bar */}
            <div className="mt-2 h-1.5 w-full rounded-full" style={{ backgroundColor: 'var(--bg-code)' }}>
              <div
                className="h-1.5 rounded-full transition-all"
                style={{ width: `${percent}%`, backgroundColor: barColor }}
              />
            </div>

            {/* Best matching sections */}
            {myChunk && bestChunk && rel.chunkScore > 0 && (
              <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <span className="font-medium">{myChunk}</span>
                {" "}matches{" "}
                <span className="font-medium">{bestChunk}</span>
              </div>
            )}

            {/* Shared terms */}
            {rel.sharedTerms.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {rel.sharedTerms.map((term) => (
                  <span
                    key={term}
                    className="inline-block rounded px-1.5 py-0.5 text-[10px]"
                    style={{ backgroundColor: 'var(--bg-code)', color: 'var(--text-secondary)' }}
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}
