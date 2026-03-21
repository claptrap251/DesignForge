import Link from "next/link";

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string | null;
    createdAt: Date | string;
    _count?: { folders: number };
  };
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const createdDate = new Date(project.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const folderCount = project._count?.folders ?? 0;

  return (
    <Link
      href={`/project/${project.id}`}
      className="group block rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 shadow-sm transition-all hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 5a1 1 0 011-1h4l2 2h6a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5z"
            />
          </svg>
        </div>
      </div>

      <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600">
        {project.name}
      </h3>

      {project.description && (
        <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{project.description}</p>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          {folderCount} {folderCount === 1 ? "folder" : "folders"}
        </span>
        <span className="flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {createdDate}
        </span>
      </div>
    </Link>
  );
}
