import { cn } from "@/ui/design-system/atoms/lib/utils";
import { MarketsProviders } from "@/ui/features/landing/sections/markets";
import { lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";

// Lazy load the markets component
const LandingMarkets = lazy(() =>
  import("@/ui/features/landing/sections/markets").then((m) => ({ default: m.LandingMarkets })),
);

interface MarketsViewProps {
  className?: string;
}

type MarketsTab = "live" | "past";

/**
 * Past markets content - shows historical market data
 */
const PastMarketsContent = () => (
  <div className="rounded-2xl border border-gold/20 bg-black/60 p-8 backdrop-blur-xl">
    <h2 className="mb-4 font-serif text-2xl text-gold">Past Markets</h2>
    <p className="text-gold/70 mb-6">View historical market activity and completed trades.</p>
    <div className="space-y-4">
      {/* Placeholder past market entries */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="rounded-lg border border-gold/10 bg-black/40 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
              <span className="text-gold text-sm font-semibold">#{i}</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gold">Game Session #{1000 - i}</h3>
              <p className="text-xs text-gold/60">Ended 2 days ago - 45 trades</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gold">12,450 $LORDS</p>
            <p className="text-xs text-gold/60">Total Volume</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/**
 * Markets view wrapper for the new landing layout.
 * Supports LIVE and PAST tabs.
 */
export const MarketsView = ({ className }: MarketsViewProps) => {
  const [searchParams] = useSearchParams();
  const activeTab = (searchParams.get("tab") as MarketsTab) || "live";

  const renderContent = () => {
    switch (activeTab) {
      case "past":
        return <PastMarketsContent />;
      case "live":
      default:
        return (
          <MarketsProviders>
            <Suspense
              fallback={
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
                </div>
              }
            >
              <LandingMarkets />
            </Suspense>
          </MarketsProviders>
        );
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {/* Markets header */}
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl font-bold text-gold sm:text-3xl">
          {activeTab === "past" ? "Past Markets" : "Markets"}
        </h1>
      </div>

      {/* Tab content */}
      {renderContent()}
    </div>
  );
};
