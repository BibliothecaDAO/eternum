import type { MarketClass } from "@/pm/class";

export const MarketPositions = ({ market: _market }: { market: MarketClass }) => {
  return (
    <div className="rounded-md border border-white/10 bg-black/40 p-3 text-sm text-gold/80">
      <p>Positions for this market are not connected in this client yet.</p>
      <p className="mt-2 text-xs text-gold/60">Connect with the full game client to view and manage your positions.</p>
    </div>
  );
};
