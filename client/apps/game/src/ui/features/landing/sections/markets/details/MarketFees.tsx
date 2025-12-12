import type { MarketClass } from "@/pm/class";

const formatFee = (value?: number) => {
  if (!Number.isFinite(value)) return "--";
  return `${value}%`;
};

export const MarketFees = ({ market }: { market: MarketClass }) => {
  return (
    <div className="w-full rounded-lg border border-white/10 bg-black/40 p-4 shadow-inner">
      <div className="mb-3">
        <p className="text-xs uppercase tracking-[0.08em] text-gold/70">Fees</p>
        <p className="text-lg font-semibold text-white">Market fees</p>
      </div>

      <div className="space-y-2 text-sm text-gold/80">
        <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
          <span>Oracle fee</span>
          <span className="text-white/90">{formatFee((market as any).oracle_fee)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
          <span>Creator fee</span>
          <span className="text-white/90">{formatFee((market as any).creator_fee)}</span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2">
          <span>Vault fee</span>
          <span className="text-white/90">{market.getVaultFees ? market.getVaultFees().toString() : "--"}</span>
        </div>
      </div>
    </div>
  );
};
