import { Button } from "@/ui/design-system/atoms";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { useAmm } from "@/hooks/use-amm";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseTokenAmount, formatTokenAmount, computeLpBurn, type Pool } from "@bibliothecadao/amm-sdk";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { resolveSelectedAmmPool } from "./amm-model";

export const AmmRemoveLiquidity = () => {
  const { client, executeSwap, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const [lpAmount, setLpAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const pool = useMemo(() => resolveSelectedAmmPool(pools, selectedPool), [pools, selectedPool]);

  const burnResult = useMemo(() => {
    if (lpAmount <= 0 || !pool) return null;
    try {
      const lpBigint = parseTokenAmount(lpAmount.toString());
      return computeLpBurn(lpBigint, pool.lordsReserve, pool.tokenReserve, pool.totalLpSupply);
    } catch {
      return null;
    }
  }, [lpAmount, pool]);

  const handleRemove = useCallback(async () => {
    if (!client || !pool || lpAmount <= 0 || !burnResult) return;
    setIsLoading(true);
    try {
      const lpBigint = parseTokenAmount(lpAmount.toString());
      const lordsMin = (burnResult.lordsOut * 95n) / 100n;
      const tokenMin = (burnResult.tokenOut * 95n) / 100n;

      const call = client.liquidity.removeLiquidity({
        ammAddress: client.ammAddress,
        tokenAddress: pool.tokenAddress,
        lpAmount: lpBigint,
        lordsMin,
        tokenMin,
      });

      await executeSwap(call);
      setLpAmount(0);
    } finally {
      setIsLoading(false);
    }
  }, [lpAmount, burnResult, pool, client, executeSwap]);

  const canRemove = Boolean(client && pool && lpAmount > 0 && burnResult !== null);

  if (!isConfigured || !client) {
    return <div className="text-sm text-gold/40">AMM is not configured.</div>;
  }

  if (!pool) {
    return <div className="text-sm text-gold/40">Select a pool to remove liquidity.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/10 bg-black/25 p-3">
        <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gold/45">Burn LP Tokens</div>
        <NumberInput
          value={lpAmount}
          onChange={setLpAmount}
          arrows={false}
          allowDecimals
          className="h-12 rounded-2xl border border-gold/10 bg-gold/12"
        />
      </div>

      {burnResult && (
        <div className="grid gap-2 rounded-2xl border border-gold/10 bg-black/25 p-3 text-xs sm:grid-cols-2">
          <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">LORDS Out</div>
            <div className="mt-1 text-sm font-semibold text-gold">{formatTokenAmount(burnResult.lordsOut)}</div>
          </div>
          <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">Token Out</div>
            <div className="mt-1 text-sm font-semibold text-gold">{formatTokenAmount(burnResult.tokenOut)}</div>
          </div>
        </div>
      )}

      <Button
        variant="gold"
        className="w-full rounded-2xl"
        forceUppercase={false}
        disabled={!canRemove}
        onClick={handleRemove}
        isLoading={isLoading}
      >
        {canRemove ? "Remove Liquidity" : "Enter LP amount"}
      </Button>
    </div>
  );
};
