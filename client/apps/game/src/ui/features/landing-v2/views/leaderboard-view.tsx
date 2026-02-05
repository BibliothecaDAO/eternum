import { cn } from "@/ui/design-system/atoms/lib/utils";
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load the leaderboard component
const LandingLeaderboard = lazy(() =>
  import("@/ui/features/landing/sections/leaderboard").then((m) => ({ default: m.LandingLeaderboard })),
);

interface LeaderboardViewProps {
  className?: string;
}

type LeaderboardTab = "ranked" | "tournaments";

/**
 * Tournaments tab content - shows past games and tournaments
 */
const TournamentsContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-8 backdrop-blur-xl">
    <h2 className="mb-4 font-serif text-2xl text-gold">Tournaments</h2>
    <p className="text-gold/70 mb-6">Browse past tournaments and game history.</p>
    <div className="space-y-4">
      {/* Placeholder tournament cards */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-lg border border-gold/10 bg-black/40 p-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gold">Tournament #{i}</h3>
            <p className="text-sm text-gold/60">Completed - 128 players</p>
          </div>
          <button className="px-4 py-2 rounded-lg border border-gold/30 text-gold/70 hover:text-gold hover:border-gold/50 transition-colors">
            View Results
          </button>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Leaderboard view wrapper for the new landing layout.
 * Supports RANKED and TOURNAMENTS tabs.
 */
export const LeaderboardView = ({ className }: LeaderboardViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as LeaderboardTab) || "ranked";

  const renderContent = () => {
    switch (activeTab) {
      case "tournaments":
        return <TournamentsContent />;
      case "ranked":
      default:
        return (
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
              </div>
            }
          >
            <LandingLeaderboard />
          </Suspense>
        );
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Leaderboard header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gold sm:text-3xl">
          {activeTab === "tournaments" ? "Tournaments" : "Leaderboard"}
        </h1>
      </div>

      {/* Tab content */}
      {renderContent()}
    </div>
  );
};
