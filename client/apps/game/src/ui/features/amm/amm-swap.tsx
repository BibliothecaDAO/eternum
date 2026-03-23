import { Button } from "@/ui/design-system/atoms";
import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmTokenInput, type TokenOption } from "./amm-token-input";
import { AmmSwapConfirmation } from "./amm-swap-confirmation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { formatTokenAmount, parseTokenAmount, type Pool } from "@bibliothecadao/amm-sdk";
import { useQuery } from "@tanstack/react-query";
import { buildAmmTokenOptions, resolveAmmSwapRoute, resolveAmmTokenName, resolveSelectedAmmPool } from "./amm-model";

export const AmmSwap = () => {
  const { client, config, executeSwap, isConfigured } = useAmm();
  const slippageBps = useAmmStore((s) => s.slippageBps);
  const selectedPool = useAmmStore((s) => s.selectedPool);
  const setSelectedPool = useAmmStore((s) => s.setSelectedPool);

  const [payAmount, setPayAmount] = useState(0);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [payToken, setPayToken] = useState(config.lordsAddress);
  const [receiveToken, setReceiveToken] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const { data: pools = [] } = useQuery<Pool[]>({
    queryKey: ["amm-pools"],
    queryFn: async () => client?.api.getPools() ?? [],
    enabled: Boolean(client),
    retry: false,
    refetchOnWindowFocus: false,
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
    if (!client || !route || !swapQuote) return;
    const amountIn = parseTokenAmount(payAmount.toString());
    const calls =
      route.kind === "routed"
        ? client.swap.swapTokenForTokenWithApproval({
            ammAddress: client.ammAddress,
            tokenInAddress: route.inputPool.tokenAddress,
            tokenOutAddress: route.outputPool.tokenAddress,
            amountIn,
            minAmountOut: swapQuote.minimumReceived,
          })
        : route.isLordsInput
          ? client.swap.swapLordsForTokenWithApproval({
              ammAddress: client.ammAddress,
              lordsAddress: client.lordsAddress,
              tokenAddress: route.pool.tokenAddress,
              lordsAmount: amountIn,
              minTokenOut: swapQuote.minimumReceived,
            })
          : client.swap.swapTokenForLordsWithApproval({
              ammAddress: client.ammAddress,
              tokenAddress: route.pool.tokenAddress,
              tokenAmount: amountIn,
              minLordsOut: swapQuote.minimumReceived,
            });

    await executeSwap(calls);
    setShowConfirmation(false);
    setPayAmount(0);
    setReceiveAmount(0);
  }, [client, executeSwap, payAmount, route, swapQuote]);

  const activePoolForFees = route?.kind === "direct" ? route.pool : route?.outputPool;
  const canSwap = Boolean(isConfigured && client && route && payAmount > 0 && receiveAmount > 0);
  const lpFeePercent = activePoolForFees
    ? (Number(activePoolForFees.feeNum) / Number(activePoolForFees.feeDenom)) * 100
    : 0;
  const protocolFeePercent = activePoolForFees
    ? (Number(activePoolForFees.protocolFeeNum) / Number(activePoolForFees.protocolFeeDenom)) * 100
    : 0;

  if (!isConfigured || !client) {
    return <div className="text-sm text-gold/40">AMM is not configured.</div>;
  }

  if (!activePool) {
    return <div className="text-sm text-gold/40">No pools available.</div>;
  }

  return (
    <div className="space-y-3">
      <AmmTokenInput
        amount={payAmount}
        onAmountChange={handlePayAmountChange}
        token={payToken}
        onTokenChange={handlePayTokenChange}
        balance="0"
        tokens={tokens}
        label="You pay"
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
        balance="0"
        tokens={tokens}
        label="You receive"
        readOnly
      />

      {swapQuote && payAmount > 0 && (
        <div className="bg-gold/10 rounded-xl p-3 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gold/60">Spot Price</span>
            <span className="text-gold">{swapQuote.spotPrice.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">Price Impact</span>
            <span className={swapQuote.priceImpact > 5 ? "text-danger" : "text-gold"}>
              {swapQuote.priceImpact.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">Minimum Received</span>
            <span className="text-gold">{formatTokenAmount(swapQuote.minimumReceived)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">LP Fee</span>
            <span className="text-gold">{lpFeePercent.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gold/60">Protocol Fee</span>
            <span className="text-gold">{protocolFeePercent.toFixed(1)}%</span>
          </div>
        </div>
      )}

      <Button variant="gold" className="w-full" disabled={!canSwap} onClick={() => setShowConfirmation(true)}>
        {canSwap ? "Swap" : "Enter an amount"}
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
