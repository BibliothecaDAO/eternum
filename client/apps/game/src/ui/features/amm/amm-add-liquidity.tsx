import { Button } from "@/ui/design-system/atoms";
import { NumberInput } from "@/ui/design-system/atoms/number-input";
import { useAmm } from "@/hooks/use-amm";
import { computeAddLiquidity, parseTokenAmount, type Pool } from "@/services/amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import {
  isPoolAwaitingInitialLiquidity,
  resolveAutoFilledTokenAmount,
  resolveLpTokensToMint,
  resolvePoolSharePercent,
} from "./amm-add-liquidity-model";
import { formatAmmPercent } from "./amm-format";
import { resolveSelectedAmmPool } from "./amm-model";
import { AMM_READ_QUERY_OPTIONS, invalidateAmmReadQueries } from "./amm-queries";

export const AmmAddLiquidity = () => {
  const { client, executeSwap, isConfigured, account } = useAmm();
  const queryClient = useQueryClient();
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const [lordsAmount, setLordsAmount] = useState(0);
  const [tokenAmount, setTokenAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const activePairAddressRef = useRef<string | null>(null);

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    ...AMM_READ_QUERY_OPTIONS,
  });

  const pool = useMemo(() => resolveSelectedAmmPool(pools, selectedPool), [pools, selectedPool]);
  const canEditTokenAmount = isPoolAwaitingInitialLiquidity(pool);

  useEffect(() => {
    const nextPairAddress = pool?.pairAddress ?? null;
    if (nextPairAddress !== activePairAddressRef.current) {
      activePairAddressRef.current = nextPairAddress;
      setLordsAmount(0);
      setTokenAmount(0);
      return;
    }

    if (!pool || canEditTokenAmount || lordsAmount <= 0) {
      return;
    }

    setTokenAmount(resolveAutoFilledTokenAmount(pool, lordsAmount));
  }, [canEditTokenAmount, lordsAmount, pool]);

  const handleLordsChange = useCallback((amount: number) => {
    setLordsAmount(amount);
  }, []);

  const handleTokenChange = useCallback((amount: number) => {
    setTokenAmount(amount);
  }, []);

  const lpTokensToMint = useMemo(() => {
    return resolveLpTokensToMint(pool, lordsAmount, tokenAmount);
  }, [lordsAmount, pool, tokenAmount]);

  const poolSharePercent = useMemo(() => {
    return resolvePoolSharePercent(pool, lordsAmount, tokenAmount);
  }, [lordsAmount, pool, tokenAmount]);

  const handleAddLiquidity = useCallback(async () => {
    if (!client || !pool || lordsAmount <= 0 || tokenAmount <= 0 || !account?.address) return;
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
        tokenAddress: pool.tokenAddress,
        lordsAmount: lordsUsed,
        tokenAmount: tokenUsed,
        lordsMin,
        tokenMin,
        recipientAddress: account.address,
      });

      await executeSwap(calls);
      await invalidateAmmReadQueries(queryClient);
      setLordsAmount(0);
      setTokenAmount(0);
    } finally {
      setIsLoading(false);
    }
  }, [account?.address, client, executeSwap, lordsAmount, pool, queryClient, tokenAmount]);

  const canAdd = Boolean(client && pool && lordsAmount > 0 && tokenAmount > 0);

  if (!isConfigured || !client) {
    return <div className="text-sm text-gold/40">The Agora is not configured.</div>;
  }

  if (!pool) {
    return <div className="text-sm text-gold/40">Select a pool to add liquidity.</div>;
  }

  const asset = resolveAmmAssetPresentation(pool.tokenAddress, client.lordsAddress);
  const helperText = canEditTokenAmount
    ? `This pool has no liquidity yet. Enter both deposits to set the opening LORDS/${asset.shortLabel} price.`
    : `The ${asset.shortLabel} side follows the current pool ratio.`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/10 bg-gold/8 px-3 py-2 text-xs text-gold/70">{helperText}</div>

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
            onChange={handleTokenChange}
            arrows={false}
            allowDecimals
            disabled={!canEditTokenAmount}
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
          <div className="mt-1 text-sm font-semibold text-gold">{formatAmmPercent(poolSharePercent)}</div>
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
