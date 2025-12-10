import type { MarketClass } from "@/pm/class";
import { HStack } from "@pm/ui";

export const MarketVaultFees = ({ market }: { market: MarketClass }) => {
  const vaultFees = market.getVaultFees ? market.getVaultFees() : 0n;

  return (
    <div className="rounded-md border border-white/10 bg-black/40 p-3 text-sm text-gold/80">
      <HStack className="justify-between">
        <span>Vault fees</span>
        <span className="text-white/90">{vaultFees.toString()}</span>
      </HStack>
      <p className="mt-2 text-xs text-gold/60">Breakdown will show once vault fee data is connected.</p>
    </div>
  );
};
