import { Button } from "@/ui/design-system/atoms";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { useAmm } from "@/hooks/use-amm";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { parseTokenAmount, formatTokenAmount, computeLpBurn, type Pool } from "@bibliothecadao/amm-sdk";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { resolveAmmPoolName, resolveSelectedAmmPool } from "./amm-model";

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
    <div className="space-y-3 mt-6">
      <h3 className="text-sm font-bold text-gold">Remove Liquidity</h3>
      <div className="text-xs text-gold/60">Pool: {resolveAmmPoolName(pool.tokenAddress)}</div>

      <div className="bg-gold/10 rounded-xl p-3">
        <div className="text-xs text-gold/60 mb-1">LP Tokens</div>
        <NumberInput value={lpAmount} onChange={setLpAmount} arrows={false} allowDecimals />
      </div>

      {burnResult && (
        <div className="bg-gold/10 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gold/60">LORDS to Receive</span>
            <span className="text-gold">{formatTokenAmount(burnResult.lordsOut)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">Token to Receive</span>
            <span className="text-gold">{formatTokenAmount(burnResult.tokenOut)}</span>
          </div>
        </div>
      )}

      <Button variant="gold" className="w-full" disabled={!canRemove} onClick={handleRemove} isLoading={isLoading}>
        {canRemove ? "Remove Liquidity" : "Enter LP amount"}
      </Button>
    </div>
  );
};
