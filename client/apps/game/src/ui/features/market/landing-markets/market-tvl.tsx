import { MarketClass } from "@/pm/class";
import { HStack } from "@pm/ui";
import { TokenIcon } from "./token-icon";

const formatTvl = (value: unknown) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (Math.abs(num) >= 1) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return num.toPrecision(2);
};

export const MarketTvl = ({ market }: { market: MarketClass }) => {
  const tvl = market.getTvl ? market.getTvl() : undefined;
  const tvlDisplay = formatTvl(tvl) ?? tvl ?? "--";
  return (
    <HStack className="gap-2 text-sm text-gold">
      <span className="text-xs uppercase text-gold/70">TVL</span>
      <span className="font-semibold text-white">{tvlDisplay}</span>
      {market.collateralToken ? <TokenIcon token={market.collateralToken as any} size={16} /> : null}
    </HStack>
  );
};
