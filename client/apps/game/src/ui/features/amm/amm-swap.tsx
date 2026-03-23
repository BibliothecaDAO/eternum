import { Button } from "@/ui/design-system/atoms";
import { useAmm } from "@/hooks/use-amm";
import { useAmmStore } from "@/hooks/store/use-amm-store";
import { AmmTokenInput, type TokenOption } from "./amm-token-input";
import { AmmSwapConfirmation } from "./amm-swap-confirmation";
import { useCallback, useMemo, useState } from "react";
import {
  formatTokenAmount,
  parseTokenAmount,
  getInputPrice,
  computePriceImpact,
  computeMinimumReceived,
  computeSpotPrice,
  type Pool,
} from "@bibliothecadao/amm-sdk";

const MOCK_TOKENS: TokenOption[] = [
  { address: "0x1", name: "LORDS" },
  { address: "0x2", name: "Wood" },
  { address: "0x3", name: "Stone" },
  { address: "0x4", name: "Coal" },
  { address: "0x5", name: "Copper" },
  { address: "0x6", name: "Ironwood" },
];

const MOCK_POOL: Pool = {
  tokenAddress: "0x2",
  lpTokenAddress: "0x100",
  lordsReserve: 1000000000000000000000n,
  tokenReserve: 5000000000000000000000n,
  totalLpSupply: 2000000000000000000000n,
  feeNum: 3n,
  feeDenom: 1000n,
  protocolFeeNum: 1n,
  protocolFeeDenom: 1000n,
};

export const AmmSwap = () => {
  const { client, executeSwap } = useAmm();
  const slippageBps = useAmmStore((s) => s.slippageBps);
  const selectedPool = useAmmStore((s) => s.selectedPool);

  const [payAmount, setPayAmount] = useState(0);
  const [receiveAmount, setReceiveAmount] = useState(0);
  const [payToken, setPayToken] = useState("0x1");
  const [receiveToken, setReceiveToken] = useState("0x2");
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isLordsInput = payToken === "0x1";
  const pool = MOCK_POOL;

  const swapQuote = useMemo(() => {
    if (payAmount <= 0) return null;
    try {
      const amountInBigint = parseTokenAmount(payAmount.toString());
      const [inputReserve, outputReserve] = isLordsInput
        ? [pool.lordsReserve, pool.tokenReserve]
        : [pool.tokenReserve, pool.lordsReserve];

      const amountOut = getInputPrice(pool.feeNum, pool.feeDenom, amountInBigint, inputReserve, outputReserve);

      const priceImpact = computePriceImpact(
        amountInBigint,
        inputReserve,
        outputReserve,
        pool.feeNum,
        pool.feeDenom,
      );

      const minReceived = computeMinimumReceived(amountOut, BigInt(slippageBps));
      const spotPrice = computeSpotPrice(pool.lordsReserve, pool.tokenReserve);

      return {
        amountOut,
        priceImpact,
        minReceived,
        spotPrice,
      };
    } catch {
      return null;
    }
  }, [payAmount, isLordsInput, pool, slippageBps]);

  const handlePayAmountChange = useCallback(
    (amount: number) => {
      setPayAmount(amount);
      if (amount > 0 && swapQuote) {
        setReceiveAmount(parseFloat(formatTokenAmount(swapQuote.amountOut)));
      } else {
        setReceiveAmount(0);
      }
    },
    [swapQuote],
  );

  // Recompute receive amount whenever quote changes
  useMemo(() => {
    if (swapQuote && payAmount > 0) {
      setReceiveAmount(parseFloat(formatTokenAmount(swapQuote.amountOut)));
    }
  }, [swapQuote, payAmount]);

  const handleInvert = useCallback(() => {
    const tempToken = payToken;
    setPayToken(receiveToken);
    setReceiveToken(tempToken);
    setPayAmount(0);
    setReceiveAmount(0);
  }, [payToken, receiveToken]);

  const handleSwapConfirm = useCallback(async () => {
    if (!swapQuote) return;
    const amountIn = parseTokenAmount(payAmount.toString());
    const calls = isLordsInput
      ? client.swap.swapLordsForToken({
          ammAddress: client.ammAddress,
          tokenAddress: receiveToken,
          lordsAmount: amountIn,
          minTokenOut: swapQuote.minReceived,
        })
      : client.swap.swapTokenForLords({
          ammAddress: client.ammAddress,
          tokenAddress: payToken,
          tokenAmount: amountIn,
          minLordsOut: swapQuote.minReceived,
        });

    await executeSwap(calls);
    setShowConfirmation(false);
    setPayAmount(0);
    setReceiveAmount(0);
  }, [swapQuote, payAmount, isLordsInput, client, receiveToken, payToken, executeSwap]);

  const canSwap = payAmount > 0 && receiveAmount > 0;
  const lpFeePercent = (Number(pool.feeNum) / Number(pool.feeDenom)) * 100;
  const protocolFeePercent = (Number(pool.protocolFeeNum) / Number(pool.protocolFeeDenom)) * 100;

  return (
    <div className="space-y-3">
      <AmmTokenInput
        amount={payAmount}
        onAmountChange={handlePayAmountChange}
        token={payToken}
        onTokenChange={setPayToken}
        balance="0"
        tokens={MOCK_TOKENS}
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
        onTokenChange={setReceiveToken}
        balance="0"
        tokens={MOCK_TOKENS}
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
            <span className="text-gold">{formatTokenAmount(swapQuote.minReceived)}</span>
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
          sellingToken={MOCK_TOKENS.find((t) => t.address === payToken)?.name ?? payToken}
          receivingAmount={receiveAmount.toString()}
          receivingToken={MOCK_TOKENS.find((t) => t.address === receiveToken)?.name ?? receiveToken}
          priceImpact={swapQuote.priceImpact.toFixed(2)}
          slippageTolerance={(slippageBps / 100).toFixed(1)}
          minimumReceived={formatTokenAmount(swapQuote.minReceived)}
          onConfirm={handleSwapConfirm}
          onCancel={() => setShowConfirmation(false)}
        />
      )}
    </div>
  );
};
