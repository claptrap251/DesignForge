"use client";

import { useState, useEffect } from "react";
import { apiUrl } from "@/lib/basePath";

interface RelatedDesignsProps {
  designId: string;
  projectId: string;
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
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (relationships.length === 0) {
    return (
      <div className="py-8 text-center">
        <svg
          className="mx-auto h-8 w-8 text-gray-300"
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
        <p className="mt-2 text-sm text-gray-400">No related designs found</p>
        <p className="mt-1 text-xs text-gray-400">
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
        const relatedOwner = isA ? rel.docBOwner : rel.docAOwner;
        const bestChunk = isA ? rel.bestChunkB : rel.bestChunkA;
        const myChunk = isA ? rel.bestChunkA : rel.bestChunkB;
        const percent = Math.round(rel.score * 100);

        const barColor =
          percent >= 70
            ? "bg-amber-500"
            : percent >= 30
            ? "bg-blue-500"
            : "bg-gray-400";

        const badgeColor =
          percent >= 70
            ? "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/50"
            : percent >= 30
            ? "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50"
            : "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700";

        return (
          <a
            key={relatedId}
            href={`/project/${projectId}/design/${relatedId}`}
            className="block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {relatedName}
                </p>
                {relatedOwner && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    by {relatedOwner}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${badgeColor}`}>
                {percent}%
              </span>
            </div>

            {/* Similarity bar */}
            <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`h-1.5 rounded-full ${barColor} transition-all`}
                style={{ width: `${percent}%` }}
              />
            </div>

            {/* Best matching sections */}
            {myChunk && bestChunk && rel.chunkScore > 0 && (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
                    className="inline-block rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-[10px] text-gray-500 dark:text-gray-400"
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
