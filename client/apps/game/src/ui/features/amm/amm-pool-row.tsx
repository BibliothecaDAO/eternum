import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { memo } from "react";

interface AmmPoolRowProps {
  iconResource: string | null;
  marketCap: string;
  spotPrice: string;
  tokenName: string;
  tvl: string;
  isSelected: boolean;
  onClick: () => void;
}

export const AmmPoolRow = memo(
  ({ iconResource, marketCap, spotPrice, tokenName, tvl, isSelected, onClick }: AmmPoolRowProps) => {
    return (
      <button
        type="button"
        className={cn(
          "group flex min-h-[68px] w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all duration-200",
          isSelected
            ? "border-gold/20 border-l-gold/60 border-l-2 bg-gold/12 shadow-[0_12px_30px_-24px_rgba(223,170,84,0.22)] backdrop-blur-[10px]"
            : "border-gold/10 bg-black/25 hover:border-gold/20 hover:bg-gold/8 backdrop-blur-[10px]",
        )}
        onClick={onClick}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/10 bg-black/40">
          {iconResource ? (
            <ResourceIcon resource={iconResource} size="sm" withTooltip={false} className="!h-6 !w-6" />
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold/70">
              {tokenName.slice(0, 2)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
            <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-gold">{tokenName}</span>
            <span className="shrink-0 text-right text-xs font-semibold uppercase tracking-[0.14em] text-gold/80">
              {spotPrice} LORDS
            </span>
            <span className="text-[10px] uppercase tracking-[0.14em] text-gold/30">Resource Pool</span>
            <div className="flex flex-col items-end text-right text-[10px] uppercase tracking-[0.14em] text-gold/55">
              <span className="whitespace-nowrap">MCap {marketCap}</span>
              <span className="whitespace-nowrap">TVL {tvl} LORDS</span>
            </div>
          </div>
        </div>
      </button>
    );
  },
);

AmmPoolRow.displayName = "AmmPoolRow";
