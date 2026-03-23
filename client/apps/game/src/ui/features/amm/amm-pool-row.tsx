import { memo } from "react";

interface AmmPoolRowProps {
  tokenAddress: string;
  tokenName: string;
  price: string;
  tvl: string;
  isSelected: boolean;
  onClick: () => void;
}

export const AmmPoolRow = memo(({ tokenName, price, tvl, isSelected, onClick }: AmmPoolRowProps) => {
  return (
    <div
      className={`flex items-center justify-between p-3 cursor-pointer transition-colors border-b border-gold/10 ${
        isSelected ? "bg-gold/20" : "hover:bg-gold/10"
      }`}
      onClick={onClick}
    >
      <div>
        <div className="text-sm font-medium text-gold">{tokenName}</div>
        <div className="text-xs text-gold/60">{price} LORDS</div>
      </div>
      <div className="text-right">
        <div className="text-xs text-gold/60">TVL</div>
        <div className="text-sm text-gold">{tvl}</div>
      </div>
    </div>
  );
});

AmmPoolRow.displayName = "AmmPoolRow";
