import { cn } from "@/ui/design-system/atoms/lib/utils";
import { lazy, Suspense } from "react";

// Lazy load the leaderboard component
const LandingLeaderboard = lazy(() =>
  import("@/ui/features/landing/sections/leaderboard").then((m) => ({ default: m.LandingLeaderboard })),
);

interface LeaderboardViewProps {
  className?: string;
}

/**
 * Leaderboard view wrapper for the new landing layout.
 * Lazy loads the existing leaderboard component.
 */
export const LeaderboardView = ({ className }: LeaderboardViewProps) => {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Leaderboard header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gold sm:text-3xl">Leaderboard</h1>
      </div>

      {/* Leaderboard content */}
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          </div>
        }
      >
        <LandingLeaderboard />
      </Suspense>
    </div>
  );
};
