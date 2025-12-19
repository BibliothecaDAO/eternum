// Shared market components - re-exported from landing for reuse
export { MarketOdds } from "@/ui/features/landing/sections/markets/market-odds";
export { MarketStatusBadge } from "@/ui/features/landing/sections/markets/market-status-badge";
export { MarketTimeline } from "@/ui/features/landing/sections/markets/market-timeline";
export { MarketTvl } from "@/ui/features/landing/sections/markets/market-tvl";
export { MaybeController } from "@/ui/features/landing/sections/markets/maybe-controller";
export { TokenIcon } from "@/ui/features/landing/sections/markets/token-icon";

// Detail components
export { MarketActivity } from "@/ui/features/landing/sections/markets/details/market-activity";
export { MarketCreatedBy } from "@/ui/features/landing/sections/markets/details/market-created-by";
export { MarketFees } from "@/ui/features/landing/sections/markets/details/market-fees";
export { MarketHistory } from "@/ui/features/landing/sections/markets/details/market-history";
export { MarketPositions } from "@/ui/features/landing/sections/markets/details/market-positions";
export { MarketResolution } from "@/ui/features/landing/sections/markets/details/market-resolution";
export { MarketResolved } from "@/ui/features/landing/sections/markets/details/market-resolved";
export { MarketTrade } from "@/ui/features/landing/sections/markets/details/market-trade";
export { UserMessages } from "@/ui/features/landing/sections/markets/details/user-messages";

// Hooks
export { useMarketRedeem } from "@/ui/features/landing/sections/markets/use-market-redeem";

// Utils
export * from "@/ui/features/landing/sections/markets/market-utils";

// Landing providers and config (needed for wrapping in-game market)
export { MARKET_FILTERS_ALL, MarketsProviders } from "@/ui/features/landing/sections/markets";
export { getPredictionMarketConfig } from "@/pm/prediction-market-config";

// In-game specific
export { InGameMarket } from "./in-game-market";
export { useCurrentGameMarket } from "./hooks/use-current-game-market";
export { useMarketPlayerNavigation } from "./hooks/use-market-player-navigation";
