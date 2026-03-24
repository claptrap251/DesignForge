interface CommentPinProps {
  pin: {
    id: string;
    pinNumber: number;
    xPercent: number | null;
    yPercent: number | null;
    resolved: boolean;
    discarded?: boolean;
    content: string;
  };
  isSelected: boolean;
  onClick: (id: string | null) => void;
}

export default function CommentPin({ pin, isSelected, onClick }: CommentPinProps) {
  if (pin.xPercent == null || pin.yPercent == null) return null;

  const bgColor = pin.discarded
    ? "bg-gray-400 line-through"
    : isSelected
      ? "bg-red-500 ring-2 ring-red-300"
      : pin.resolved
        ? "bg-green-500"
        : "bg-indigo-600";

  return (
    <div
      className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
      style={{
        left: `${pin.xPercent}%`,
        top: `${pin.yPercent}%`,
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick(isSelected ? null : pin.id);
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow-md transition-all hover:scale-110 hover:opacity-100 ${bgColor} ${isSelected ? "opacity-100" : "opacity-40"}`}
      >
        {pin.pinNumber}
      </button>

      <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg group-hover:block">
        <span className="line-clamp-2 max-w-[200px] whitespace-normal">
          {pin.content}
        </span>
        <div className="absolute left-1/2 top-full -translate-x-1/2">
          <div className="h-0 w-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900" />
        </div>
      </div>
    </div>
  );
}
