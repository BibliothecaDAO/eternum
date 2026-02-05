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

const LEADERBOARD_TABS: Array<{ id: LeaderboardTab; label: string }> = [
  { id: "ranked", label: "Ranked" },
  { id: "tournaments", label: "Tournaments" },
];

const LoadingSpinner = () => (
  <div className="flex h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
  </div>
);

/**
 * Leaderboard view wrapper for the new landing layout.
 * - RANKED tab: Shows MMR leaderboard
 * - TOURNAMENTS tab: Shows Score to Beat panel
 */
export const LeaderboardView = ({ className }: LeaderboardViewProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get("leaderboard") as LeaderboardTab) || "ranked";

  const handleTabChange = (tab: LeaderboardTab) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("leaderboard", tab);
    setSearchParams(newParams);
  };

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
        "relative h-[90vh] w-full max-w-5xl space-y-6 overflow-y-auto rounded-3xl border border-gold/20 bg-gradient-to-br from-gold/5 via-black/40 to-black/90 p-8 text-gold shadow-[0_35px_70px_-25px_rgba(12,10,35,0.85)] backdrop-blur-xl md:max-h-[80vh]",
        className,
      )}
    >
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Leaderboard sections"
        aria-orientation="horizontal"
        className="flex gap-2 rounded-3xl border border-gold/20 bg-gold/5 p-1 text-sm font-semibold"
      >
        {LEADERBOARD_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 rounded-2xl px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold/60 ${
                isActive
                  ? "bg-gold text-black shadow-[0_20px_45px_-25px_rgba(255,215,128,0.85)]"
                  : "text-gold/70 hover:bg-gold/10 hover:text-gold"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="focus-visible:outline-none">{renderContent()}</div>
    </section>
  );
};
