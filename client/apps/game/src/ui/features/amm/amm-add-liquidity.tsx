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
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { formatAmmPercent } from "./amm-format";
import { resolveSelectedAmmPool } from "./amm-model";

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

  const asset = resolveAmmAssetPresentation(pool.tokenAddress, client.lordsAddress);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-gold/10 bg-black/25 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gold/45">Deposit LORDS</div>
          <NumberInput
            value={lordsAmount}
            onChange={handleLordsChange}
            arrows={false}
            allowDecimals
            className="h-12 rounded-2xl border border-gold/10 bg-gold/12"
          />
        </div>

        <div className="rounded-2xl border border-gold/10 bg-black/25 p-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-gold/45">Deposit {asset.displayName}</div>
          <NumberInput
            value={tokenAmount}
            onChange={setTokenAmount}
            arrows={false}
            allowDecimals
            disabled
            className="h-12 rounded-2xl border border-gold/10 bg-gold/12"
          />
        </div>
      </div>

      <div className="grid gap-2 rounded-2xl border border-gold/10 bg-black/25 p-3 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">LP to Mint</div>
          <div className="mt-1 text-sm font-semibold text-gold">{lpTokensToMint}</div>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">New Pool Share</div>
          <div className="mt-1 text-sm font-semibold text-gold">{formatAmmPercent(Number(poolSharePercent))}</div>
        </div>
      </div>

      <Button
        variant="gold"
        className="w-full rounded-2xl"
        forceUppercase={false}
        disabled={!canAdd}
        onClick={handleAddLiquidity}
        isLoading={isLoading}
      >
        {canAdd ? "Add Liquidity" : "Enter amounts"}
      </Button>
    </div>
  );
};
