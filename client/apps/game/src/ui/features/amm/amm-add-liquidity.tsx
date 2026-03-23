import { Button } from "@/ui/design-system/atoms";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  parseTokenAmount,
  formatTokenAmount,
  quote,
  computeLpMint,
  computeAddLiquidity,
  type Pool,
} from "@bibliothecadao/amm-sdk";
import { resolveAmmPoolName, resolveSelectedAmmPool } from "./amm-model";

export const AmmAddLiquidity = () => {
  const { client, executeSwap, isConfigured } = useAmm();
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const [lordsAmount, setLordsAmount] = useState(0);
  const [tokenAmount, setTokenAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const pool = useMemo(() => resolveSelectedAmmPool(pools, selectedPool), [pools, selectedPool]);

  const handleLordsChange = useCallback(
    (amount: number) => {
      setLordsAmount(amount);
      if (amount > 0 && pool && pool.lordsReserve > 0n) {
        try {
          const lordsBigint = parseTokenAmount(amount.toString());
          const tokenOptimal = quote(lordsBigint, pool.lordsReserve, pool.tokenReserve);
          setTokenAmount(parseFloat(formatTokenAmount(tokenOptimal)));
        } catch {
          setTokenAmount(0);
        }
      } else {
        setTokenAmount(0);
      }
    },
    [pool],
  );

  const lpTokensToMint = useMemo(() => {
    if (lordsAmount <= 0 || !pool) return "0";
    try {
      const lordsBigint = parseTokenAmount(lordsAmount.toString());
      const lp = computeLpMint(lordsBigint, pool.lordsReserve, pool.totalLpSupply);
      return formatTokenAmount(lp);
    } catch {
      return "0";
    }
  }, [lordsAmount, pool]);

  const poolSharePercent = useMemo(() => {
    if (lordsAmount <= 0 || !pool) return "0";
    try {
      const lordsBigint = parseTokenAmount(lordsAmount.toString());
      const lp = computeLpMint(lordsBigint, pool.lordsReserve, pool.totalLpSupply);
      const newTotal = pool.totalLpSupply + lp;
      return ((Number(lp) / Number(newTotal)) * 100).toFixed(2);
    } catch {
      return "0";
    }
  }, [lordsAmount, pool]);

  const handleAddLiquidity = useCallback(async () => {
    if (!client || !pool || lordsAmount <= 0 || tokenAmount <= 0) return;
    setIsLoading(true);
    try {
      const lordsBigint = parseTokenAmount(lordsAmount.toString());
      const tokenBigint = parseTokenAmount(tokenAmount.toString());
      const { lordsUsed, tokenUsed } = computeAddLiquidity(
        lordsBigint,
        tokenBigint,
        pool.lordsReserve,
        pool.tokenReserve,
      );
      const lordsMin = (lordsUsed * 95n) / 100n;
      const tokenMin = (tokenUsed * 95n) / 100n;

      const calls = client.liquidity.addLiquidityWithApproval({
        ammAddress: client.ammAddress,
        lordsAddress: client.lordsAddress,
        tokenAddress: pool.tokenAddress,
        lordsAmount: lordsUsed,
        tokenAmount: tokenUsed,
        lordsMin,
        tokenMin,
      });

      await executeSwap(calls);
      setLordsAmount(0);
      setTokenAmount(0);
    } finally {
      setIsLoading(false);
    }
  }, [lordsAmount, tokenAmount, pool, client, executeSwap]);

  const canAdd = Boolean(client && pool && lordsAmount > 0 && tokenAmount > 0);

  if (!isConfigured || !client) {
    return <div className="text-sm text-gold/40">AMM is not configured.</div>;
  }

  if (!pool) {
    return <div className="text-sm text-gold/40">Select a pool to add liquidity.</div>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gold">Add Liquidity</h3>
      <div className="text-xs text-gold/60">Pool: {resolveAmmPoolName(pool.tokenAddress)}</div>

      <div className="bg-gold/10 rounded-xl p-3">
        <div className="text-xs text-gold/60 mb-1">LORDS</div>
        <NumberInput value={lordsAmount} onChange={handleLordsChange} arrows={false} allowDecimals />
      </div>

      <div className="bg-gold/10 rounded-xl p-3">
        <div className="text-xs text-gold/60 mb-1">Token</div>
        <NumberInput value={tokenAmount} onChange={setTokenAmount} arrows={false} allowDecimals disabled />
      </div>

      <div className="bg-gold/10 rounded-xl p-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-gold/60">LP Tokens to Mint</span>
          <span className="text-gold">{lpTokensToMint}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gold/60">Pool Share</span>
          <span className="text-gold">{poolSharePercent}%</span>
        </div>
      </div>

      <Button variant="gold" className="w-full" disabled={!canAdd} onClick={handleAddLiquidity} isLoading={isLoading}>
        {canAdd ? "Add Liquidity" : "Enter amounts"}
      </Button>
    </div>
  );
};
