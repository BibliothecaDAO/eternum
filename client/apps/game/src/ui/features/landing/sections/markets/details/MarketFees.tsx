import type { MarketClass } from "@/pm/class";
import { Card, CardContent, HStack } from "@pm/ui";

const formatFee = (value?: number) => {
  if (!Number.isFinite(value)) return "--";
  return `${value}%`;
};

export const MarketFees = ({ market }: { market: MarketClass }) => {
  return (
    <Card className="bg-white/5">
      <CardContent className="space-y-2">
        <HStack className="justify-between text-sm text-gold/80">
          <span>Oracle fee</span>
          <span className="text-white/90">{formatFee((market as any).oracle_fee)}</span>
        </HStack>
        <HStack className="justify-between text-sm text-gold/80">
          <span>Creator fee</span>
          <span className="text-white/90">{formatFee((market as any).creator_fee)}</span>
        </HStack>
        <HStack className="justify-between text-sm text-gold/80">
          <span>Vault fee</span>
          <span className="text-white/90">
            {market.getVaultFees ? market.getVaultFees().toString() : "--"}
          </span>
        </HStack>
      </CardContent>
    </Card>
  );
};
