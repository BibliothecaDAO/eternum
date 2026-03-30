import clsx from "clsx";

export type LoaderProgressMode = "indeterminate" | "determinate";

export const resolveDeterminateSegmentCount = (progress: number, segments: number) => {
  const safeSegments = Number.isFinite(segments) ? Math.max(1, Math.floor(segments)) : 8;
  const safeProgress = Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : 0;

  if (safeProgress <= 0) {
    return 0;
  }

  return Math.min(safeSegments, Math.round((safeProgress / 100) * safeSegments));
};

type SegmentedBracketLoaderProps = {
  className?: string;
  mode?: LoaderProgressMode;
  progress?: number;
  segments?: number;
};

export const SegmentedBracketLoader = ({
  className,
  mode = "indeterminate",
  progress = 0,
  segments = 8,
}: SegmentedBracketLoaderProps) => {
  const safeSegments = Math.max(1, Math.floor(segments));
  const filledCount = mode === "determinate" ? resolveDeterminateSegmentCount(progress, safeSegments) : 0;

  return (
    <div className={clsx("boot-loader-brackets flex items-center justify-center gap-2", className)} aria-hidden="true">
      <span className="boot-loader-bracket-symbol text-gold/65">[</span>
      <div className="flex items-center gap-2">
        {Array.from({ length: safeSegments }, (_, index) => {
          const isFilled = index < filledCount;
          const isLead = filledCount > 0 && index === filledCount - 1;

          return (
            <span
              key={index}
              className={clsx(
                "boot-loader-segment block h-4 w-4 rounded-[2px] border border-gold/45 bg-transparent shadow-[0_0_0_1px_rgba(8,10,12,0.2)_inset]",
                mode === "indeterminate" ? "boot-loader-segment-indeterminate" : "",
                isFilled ? "boot-loader-segment-filled" : "",
                isLead ? "boot-loader-segment-lead" : "",
              )}
              data-mode={mode}
              data-filled={isFilled ? "true" : "false"}
              style={
                mode === "indeterminate"
                  ? {
                      animationDelay: `${index * 140}ms`,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      <span className="boot-loader-bracket-symbol text-gold/65">]</span>
    </div>
  );
};
