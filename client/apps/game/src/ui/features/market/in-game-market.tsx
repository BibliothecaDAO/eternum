import { useMemo } from "react";
import { RefreshCw } from "lucide-react";

import { getActiveWorldName } from "@/runtime/world";
import { configManager } from "@bibliothecadao/eternum";

import { useCurrentGameMarket } from "./hooks/use-current-game-market";
import { MarketCreationSection, MarketDetailsSection } from "./components";
import { MarketsProviders } from "./index";

/**
 * Loading state component for the market panel.
 */
const MarketLoadingState = () => (
  <div className="flex h-full items-center justify-center p-4">
    <div className="text-center text-sm text-gold/70">
      <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
      Loading prediction market...
    </div>
  </div>
);

/**
 * Orchestrator component that decides which market section to render.
 *
 * This is a thin component that:
 * 1. Fetches the current game market state
 * 2. Determines the world name for market creation
 * 3. Gets the game end time from season config
 * 4. Delegates rendering to either MarketCreationSection or MarketDetailsSection
 *
 * All hooks are called unconditionally at the top to avoid hooks order issues.
 */
const InGameMarketContent = () => {
  // All hooks called unconditionally at the top
  const { gameMarket, isLoading, refresh: refreshMarkets, currentPrizeAddress } = useCurrentGameMarket();

  // Get world name for market creation (memoized since it reads from localStorage)
  const worldName = useMemo(() => getActiveWorldName(), []);

  // Get game end time from season config
  const gameEndTime = useMemo(() => {
    const seasonConfig = configManager.getSeasonConfig();
    return seasonConfig?.endAt ?? null;
  }, []);

  // Render loading state
  if (isLoading) {
    return <MarketLoadingState />;
  }

  // Render creation UI if no market exists
  if (!gameMarket) {
    return (
      <MarketCreationSection
        worldName={worldName}
        oracleAddress={currentPrizeAddress}
        gameEndTime={gameEndTime}
        onRefresh={refreshMarkets}
      />
    );
  }

  // Render market details if market exists
  return <MarketDetailsSection initialMarket={gameMarket} onRefreshMarkets={refreshMarkets} />;
};

/**
 * In-game prediction market panel.
 * Shows the market associated with the current game session.
 */
export const InGameMarket = () => {
  return (
    <MarketsProviders>
      <InGameMarketContent />
    </MarketsProviders>
  );
};
