import { getAmountOut } from "./math";

export function computePriceImpact(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeAmount: bigint): number {
  if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) {
    return 0;
  }

  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut, feeAmount);
  if (amountOut === 0n) {
    return 100;
  }

  const effectiveNumerator = amountOut * reserveIn;
  const effectiveDenominator = amountIn * reserveOut;
  const impact = (1 - Number(effectiveNumerator) / Number(effectiveDenominator)) * 100;

  return Math.max(0, impact);
}

export function computeMinimumReceived(amountOut: bigint, slippageBps: bigint): bigint {
  if (slippageBps < 0n || slippageBps > 10000n) {
    throw new Error("slippage must be between 0 and 10000 bps");
  }

  return (amountOut * (10000n - slippageBps)) / 10000n;
}

export function computeSpotPrice(baseReserve: bigint, quoteReserve: bigint): number {
  if (baseReserve <= 0n || quoteReserve <= 0n) {
    return 0;
  }

  return Number(quoteReserve) / Number(baseReserve);
}
