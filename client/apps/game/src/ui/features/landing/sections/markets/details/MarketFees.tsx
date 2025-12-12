import type { MarketClass } from "@/pm/class";

const formatFee = (value?: number) => {
  if (!Number.isFinite(value)) return "--";
  return `${value}%`;
};

export const MarketFees = ({ market }: { market: MarketClass }) => {
  return (
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
  );
};
