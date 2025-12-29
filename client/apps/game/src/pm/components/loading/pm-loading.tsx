import { Loader2 } from "lucide-react";

/**
 * Skeleton for chart components (fixed height container to prevent layout shifts)
 */
export const PMChartSkeleton = () => (
  <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4">
    <div className="mb-4 flex justify-between">
      <div className="h-6 w-32 animate-pulse rounded bg-white/10" />
      <div className="h-6 w-48 animate-pulse rounded bg-white/10" />
    </div>
    <div className="h-[320px] animate-pulse rounded bg-white/5" />
  </div>
);

/**
 * Skeleton for holders/positions list
 */
export const PMHoldersSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          <div className="h-6 w-full animate-pulse rounded bg-white/10" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton for activity feed items
 */
export const PMActivitySkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
          <div className="h-5 w-48 animate-pulse rounded bg-white/10" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Error state component with optional retry button
 */
export const PMErrorState = ({
  message = "Something went wrong",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) => (
  <div className="w-full rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-5">
    <p className="text-sm text-red-400">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20"
      >
        Try again
      </button>
    )}
  </div>
);

/**
 * Inline loading spinner for buttons
 */
export const PMButtonSpinner = ({ className = "" }: { className?: string }) => (
  <Loader2 className={`h-4 w-4 animate-spin ${className}`} />
);
