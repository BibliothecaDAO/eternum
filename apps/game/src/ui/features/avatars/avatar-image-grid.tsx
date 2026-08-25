import clsx from "clsx";

interface AvatarImageGridProps {
  images: string[];
  selectedUrl?: string | null;
  onSelect?: (url: string) => void;
  isSelecting?: boolean;
  className?: string;
}

export const AvatarImageGrid = ({
  images,
  selectedUrl,
  onSelect,
  isSelecting = false,
  className,
}: AvatarImageGridProps) => {
  if (!images.length) {
    return null;
  }

  return (
    <div className={clsx("grid grid-cols-2 gap-3", className)}>
      {images.map((url) => {
        const isSelected = selectedUrl === url;
        const isDisabled = !onSelect || isSelecting;

        return (
          <button
            key={url}
            type="button"
            className={clsx(
              "group relative overflow-hidden rounded-lg border bg-black/20 transition",
              isSelected ? "border-gold/70" : "border-gold/20 hover:border-gold/40",
              isDisabled && "cursor-default",
            )}
            onClick={() => {
              if (!onSelect || isSelected) return;
              onSelect(url);
            }}
            disabled={isDisabled}
            aria-pressed={isSelected}
          >
            <img className="h-28 w-full object-cover" src={url} alt="Generated avatar option" />
            {onSelect && (
              <div
                className={clsx(
                  "absolute inset-0 flex items-end justify-center pb-2 text-xs font-semibold uppercase tracking-wide",
                  isSelected
                    ? "bg-black/55 text-gold"
                    : "bg-black/0 text-transparent group-hover:bg-black/40 group-hover:text-gold",
                )}
              >
                {isSelected ? "Active" : "Use"}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};
