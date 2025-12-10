import type { MarketClass } from "@/pm/class";

export const MarketResolved = ({ market }: { market: MarketClass }) => {
  if (!market.isResolved()) return null;

  return (
    <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
      <div className="font-semibold uppercase tracking-wide">Resolved</div>
      <div className="text-emerald-50">
        This market has been resolved. Outcome details will appear once resolution data is available.
      </div>
    </div>
  );
};
