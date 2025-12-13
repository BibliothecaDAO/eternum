import { type MarketLeaderboardRange } from "./use-market-stats";

export type MarketTab = "markets" | "leaderboard" | "player";

export const MARKET_TABS: Array<{ id: MarketTab; label: string }> = [
  { id: "markets", label: "Markets" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "player", label: "Player" },
];

export const LEADERBOARD_RANGES: Array<{ id: MarketLeaderboardRange; label: string }> = [
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "all", label: "All time" },
];

export const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(value || 0);

export const TabButton = ({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) => (
  <button
    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
      isActive ? "bg-gold/30 text-white shadow-lg shadow-gold/10" : "bg-white/5 text-gold/70 hover:bg-white/10"
    }`}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);
