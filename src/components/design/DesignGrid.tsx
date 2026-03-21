import DesignCard from "./DesignCard";

interface DesignGridProps {
  designs: any[];
  folderId: string;
  onUpload: () => void;
  projectId?: string;
  shareToken?: string;
  onDeleteDesign?: (designId: string) => void;
}

export default function DesignGrid({ designs, folderId, onUpload, projectId, shareToken, onDeleteDesign }: DesignGridProps) {
  if (designs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-16">
        <svg
          className="h-12 w-12 text-gray-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
          />
        </svg>
        <p className="mt-3 text-sm font-medium text-gray-600">No designs yet</p>
        <p className="mt-1 text-sm text-gray-400">Upload an image or create a markdown document</p>
        <button
          onClick={onUpload}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          Upload Design
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {designs.map((design) => (
          <DesignCard key={design.id} design={design} projectId={projectId || folderId} shareToken={shareToken} onDelete={onDeleteDesign} />
        ))}
      </div>
    </div>
  );
}
