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

export const TabButton = ({ isActive, label, onClick }: { isActive: boolean; label: string; onClick: () => void }) => (
  <button
    className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-gold text-black shadow-[0_20px_45px_-25px_rgba(255,215,128,0.85)]"
        : "border border-gold/20 bg-gold/5 text-gold/70 hover:bg-gold/10 hover:border-gold/40"
    }`}
    onClick={onClick}
    type="button"
  >
    {label}
  </button>
);
