import { cn } from "@/ui/design-system/atoms/lib/utils";
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load the components
const MMRLeaderboard = lazy(() => import("../components/mmr-leaderboard").then((m) => ({ default: m.MMRLeaderboard })));

const ScoreToBeatPanel = lazy(() => import("./score-to-beat-panel").then((m) => ({ default: m.ScoreToBeatPanel })));

interface LeaderboardViewProps {
  className?: string;
}

type LeaderboardTab = "ranked" | "tournaments";

const LoadingSpinner = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

/**
 * Leaderboard view wrapper for the new landing layout.
 * Content is determined by the top-level navigation (RANKED/TOURNAMENTS).
 * - RANKED: Shows MMR leaderboard
 * - TOURNAMENTS: Shows Score to Beat panel
 */
export const LeaderboardView = ({ className }: LeaderboardViewProps) => {
  const [searchParams] = useSearchParams();
  // The tab is controlled by the top-level navigation via URL params
  const activeTab = (searchParams.get("tab") as LeaderboardTab) || "ranked";

  const renderContent = () => {
    switch (activeTab) {
      case "tournaments":
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <ScoreToBeatPanel />
          </Suspense>
        );
      case "ranked":
      default:
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <MMRLeaderboard />
          </Suspense>
        );
    }
  };

  return (
    <section
      className={cn(
        "relative h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 text-gold shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]",
        className,
      )}
    >
      {renderContent()}
    </section>
  );
};
