import { Button } from "@/ui/design-system/atoms";
import { useAmm } from "@/hooks/use-amm";
import { formatTokenAmount, parseTokenAmount, type Pool } from "@/services/amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmTokenInput, type TokenOption } from "./amm-token-input";
import { AmmSwapConfirmation } from "./amm-swap-confirmation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/ui/design-system/atoms/lib/utils";
import { useResourceBalance } from "@/hooks/use-resource-balance";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  buildAmmTokenOptions,
  resolveAmmFeeBreakdown,
  resolveAmmSwapRoute,
  resolveAmmTokenName,
  resolveSelectedAmmPool,
} from "./amm-model";
import { formatAmmMinimumReceived, formatAmmPercent, formatAmmSpotPrice } from "./amm-format";
import { resolveAmmAssetPresentation } from "./amm-asset-presentation";
import { AMM_READ_QUERY_OPTIONS, invalidateAmmReadQueries } from "./amm-queries";
import { ResourceIcon } from "@/ui/design-system/molecules/resource-icon";

const RouteToken = ({ asset }: { asset: { displayName: string; shortLabel: string; iconResource: string | null } }) => (
  <span className="inline-flex items-center gap-1.5">
    {asset.iconResource ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/10 bg-black/40">
        <ResourceIcon resource={asset.iconResource} size="xs" withTooltip={false} className="!h-3.5 !w-3.5" />
      </span>
    ) : (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-gold/10 bg-gold/10 text-[8px] font-bold text-gold">
        {asset.shortLabel.slice(0, 2)}
      </span>
    )}
    <span>{asset.shortLabel}</span>
  </span>
);

function resolveSwapButtonLabel(
  canSwap: boolean,
  payAmount: number,
  activePool: Pool | null,
  route: unknown | null,
  insufficientBalance: boolean,
): string {
  if (insufficientBalance) return "Insufficient balance";
  if (canSwap) return "Swap";
  if (!activePool) return "Select a pool";
  if (!route) return "Invalid pair";
  if (payAmount <= 0) return "Enter an amount";
  return "Enter an amount";
}

export const AmmSwap = () => {
  const { client, config, executeSwap, isConfigured, account } = useAmm();
  const queryClient = useQueryClient();
  const slippageBps = useAmmStore((s) => s.slippageBps);
  const setSlippageBps = useAmmStore((s) => s.setSlippageBps);
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const setSelectedPool = useAmmStore((s) => s.setSelectedPool);

  const [payAmount, setPayAmount] = useState(0);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [payToken, setPayToken] = useState(config.lordsAddress);
  const [receiveToken, setReceiveToken] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSlippage, setShowSlippage] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);

  const { balance: payTokenBalance } = useResourceBalance({
    resourceAddress: payToken || null,
  });
  const { balance: receiveTokenBalance } = useResourceBalance({
    resourceAddress: receiveToken || null,
  });

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    ...AMM_READ_QUERY_OPTIONS,
  });

  const activePool = useMemo(() => resolveSelectedAmmPool(pools, selectedPool), [pools, selectedPool]);
  const tokens = useMemo<TokenOption[]>(
    () => buildAmmTokenOptions(pools, config.lordsAddress),
    [pools, config.lordsAddress],
  );

  useEffect(() => {
    if (!activePool) {
      return;
    }

    if (!receiveToken || (payToken !== activePool.tokenAddress && receiveToken !== activePool.tokenAddress)) {
      setPayToken(config.lordsAddress);
      setReceiveToken(activePool.tokenAddress);
      setPayAmount(0);
      setReceiveAmount(0);
    }
  }, [activePool, config.lordsAddress, payToken, receiveToken]);

  const route = useMemo(
    () => resolveAmmSwapRoute(pools, config.lordsAddress, payToken, receiveToken),
    [pools, config.lordsAddress, payToken, receiveToken],
  );

  const swapQuote = useMemo(() => {
    if (payAmount <= 0 || !client || !route) return null;

    try {
      const amountInBigint = parseTokenAmount(payAmount.toString());

      if (route.kind === "direct") {
        const directQuote = client.quoteSwap(route.pool, amountInBigint, route.isLordsInput, BigInt(slippageBps));

        return {
          amountOut: directQuote.amountOut,
          minimumReceived: directQuote.minimumReceived,
          priceImpact: directQuote.priceImpact,
          spotPrice: directQuote.spotPriceBefore,
        };
      }

      const firstHopQuote = client.quoteSwap(route.inputPool, amountInBigint, false, 0n);
      const secondHopQuote = client.quoteSwap(route.outputPool, firstHopQuote.amountOut, true, BigInt(slippageBps));
      const effectivePrice = amountInBigint > 0n ? Number(secondHopQuote.amountOut) / Number(amountInBigint) : 0;

      return {
        amountOut: secondHopQuote.amountOut,
        minimumReceived: secondHopQuote.minimumReceived,
        priceImpact: firstHopQuote.priceImpact + secondHopQuote.priceImpact,
        spotPrice: effectivePrice,
      };
    } catch {
      return null;
    }
  }, [client, payAmount, route, slippageBps]);

  const handlePayAmountChange = useCallback((amount: number) => {
    setPayAmount(amount);
  }, []);

  useEffect(() => {
    if (swapQuote && payAmount > 0) {
      setReceiveAmount(parseFloat(formatTokenAmount(swapQuote.amountOut)));
      return;
    }
    setReceiveAmount(0);
  }, [swapQuote, payAmount]);

  const handleInvert = useCallback(() => {
    const tempToken = payToken;
    setPayToken(receiveToken);
    setReceiveToken(tempToken);
    setPayAmount(0);
    setReceiveAmount(0);
  }, [payToken, receiveToken]);

  const handlePayTokenChange = useCallback(
    (token: string) => {
      setPayToken(token);
      if (token !== config.lordsAddress) {
        setSelectedPool(token);
      }
      setPayAmount(0);
      setReceiveAmount(0);
    },
    [config.lordsAddress, setSelectedPool],
  );

  const handleReceiveTokenChange = useCallback(
    (token: string) => {
      setReceiveToken(token);
      if (token !== config.lordsAddress) {
        setSelectedPool(token);
      }
      setPayAmount(0);
      setReceiveAmount(0);
    },
    [config.lordsAddress, setSelectedPool],
  );

  const handleSwapConfirm = useCallback(async () => {
    if (!client || !route || !swapQuote || !account?.address) return;
    setIsSwapping(true);
    try {
      const amountIn = parseTokenAmount(payAmount.toString());
      const calls =
        route.kind === "routed"
          ? client.swap.swapTokenForTokenWithApproval({
              tokenInAddress: route.inputPool.tokenAddress,
              tokenOutAddress: route.outputPool.tokenAddress,
              amountIn,
              minAmountOut: swapQuote.minimumReceived,
              recipientAddress: account.address,
            })
          : route.isLordsInput
            ? client.swap.swapLordsForTokenWithApproval({
                tokenAddress: route.pool.tokenAddress,
                lordsAmount: amountIn,
                minTokenOut: swapQuote.minimumReceived,
                recipientAddress: account.address,
              })
            : client.swap.swapTokenForLordsWithApproval({
                tokenAddress: route.pool.tokenAddress,
                tokenAmount: amountIn,
                minLordsOut: swapQuote.minimumReceived,
                recipientAddress: account.address,
              });

      await executeSwap(calls);
      await invalidateAmmReadQueries(queryClient);
      setShowConfirmation(false);
      setPayAmount(0);
      setReceiveAmount(0);
    } finally {
      setIsSwapping(false);
    }
  }, [account?.address, client, executeSwap, payAmount, queryClient, route, swapQuote]);

  const activePoolForFees = route?.kind === "direct" ? route.pool : route?.outputPool;
  const payAmountBigint = payAmount > 0 ? parseTokenAmount(payAmount.toString()) : 0n;
  const insufficientBalance = payAmount > 0 && payAmountBigint > payTokenBalance;
  const canSwap = Boolean(
    isConfigured && client && route && payAmount > 0 && receiveAmount > 0 && !insufficientBalance,
  );
  const feeBreakdown = resolveAmmFeeBreakdown(activePoolForFees);

  if (!isConfigured || !client) {
    return <div className="text-sm text-gold/40">The Agora is not configured.</div>;
  }

  if (!activePool) {
    return <div className="text-sm text-gold/40">No pools available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/10 bg-black/25 px-4 py-3">
        {route?.kind === "routed" ? (
          <div className="flex items-center gap-2 text-sm font-medium text-gold">
            <RouteToken asset={resolveAmmAssetPresentation(payToken, config.lordsAddress)} />
            <span className="text-gold/30">&rarr;</span>
            <RouteToken asset={resolveAmmAssetPresentation(config.lordsAddress, config.lordsAddress)} />
            <span className="text-gold/30">&rarr;</span>
            <RouteToken asset={resolveAmmAssetPresentation(receiveToken, config.lordsAddress)} />
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium text-gold">
            <RouteToken asset={resolveAmmAssetPresentation(activePool.tokenAddress, config.lordsAddress)} />
            <span className="text-gold/30">/</span>
            <RouteToken asset={resolveAmmAssetPresentation(config.lordsAddress, config.lordsAddress)} />
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-gold/50 hover:text-gold transition-colors"
          onClick={() => setShowSlippage(!showSlippage)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
          Slippage: {(slippageBps / 100).toFixed(1)}%
        </button>
      </div>

      {showSlippage && (
        <div className="rounded-2xl border border-gold/10 bg-black/30 p-3">
          <div className="mb-2 text-[10px] uppercase tracking-[0.16em] text-gold/40">Slippage Tolerance</div>
          <div className="flex gap-2">
            {[25, 50, 100, 200].map((bps) => (
              <button
                key={bps}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                  slippageBps === bps
                    ? "bg-gold/20 text-gold"
                    : "border border-gold/10 bg-black/25 text-gold/55 hover:text-gold hover:bg-gold/10",
                )}
                onClick={() => setSlippageBps(bps)}
              >
                {(bps / 100).toFixed(1)}%
              </button>
            ))}
          </div>
        </div>
      )}

      <AmmTokenInput
        amount={payAmount}
        onAmountChange={handlePayAmountChange}
        token={payToken}
        onTokenChange={handlePayTokenChange}
        tokens={tokens}
        label="You pay"
        balance={formatTokenAmount(payTokenBalance)}
      />

      <div className="flex justify-center">
        <button
          className="w-8 h-8 rounded-full bg-gold/20 hover:bg-gold/30 flex items-center justify-center text-gold transition-colors"
          onClick={handleInvert}
        >
          <span className="text-lg leading-none select-none" style={{ transform: "rotate(0deg)" }}>
            &uarr;&darr;
          </span>
        </button>
      </div>

      <AmmTokenInput
        amount={receiveAmount}
        onAmountChange={setReceiveAmount}
        token={receiveToken}
        onTokenChange={handleReceiveTokenChange}
        tokens={tokens}
        label="You receive"
        readOnly
        balance={formatTokenAmount(receiveTokenBalance)}
      />

      {swapQuote && payAmount > 0 && (
        <div className="grid gap-2 rounded-2xl border border-gold/10 bg-black/25 p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Spot Price", value: `${formatAmmSpotPrice(swapQuote.spotPrice)} LORDS` },
            {
              label: "Price Impact",
              value: formatAmmPercent(swapQuote.priceImpact),
              tone: swapQuote.priceImpact > 5 ? "text-danger" : "text-gold",
            },
            { label: "Minimum Received", value: formatAmmMinimumReceived(swapQuote.minimumReceived) },
            { label: "Total Fees", value: formatAmmPercent(feeBreakdown.totalFeePercent) },
          ].map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-xl border border-gold/10 bg-black/20 px-3 py-2">
              <div className="text-[10px] uppercase tracking-[0.16em] text-gold/40">{metric.label}</div>
              <div className={cn("mt-1 break-all text-sm font-semibold text-gold", metric.tone)}>{metric.value}</div>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="gold"
        className="w-full rounded-2xl"
        forceUppercase={false}
        disabled={!canSwap}
        isLoading={isSwapping}
        onClick={() => setShowConfirmation(true)}
      >
        {resolveSwapButtonLabel(canSwap, payAmount, activePool, route, insufficientBalance)}
      </Button>

      {showConfirmation && swapQuote && (
        <AmmSwapConfirmation
          sellingAmount={payAmount.toString()}
          sellingToken={resolveAmmTokenName(payToken, config.lordsAddress)}
          receivingAmount={receiveAmount.toString()}
          receivingToken={resolveAmmTokenName(receiveToken, config.lordsAddress)}
          priceImpact={swapQuote.priceImpact.toFixed(2)}
          slippageTolerance={(slippageBps / 100).toFixed(1)}
          minimumReceived={formatTokenAmount(swapQuote.minimumReceived)}
          onConfirm={handleSwapConfirm}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
};
