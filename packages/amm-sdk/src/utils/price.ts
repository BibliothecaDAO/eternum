import { getInputPrice } from "./math";

/**
 * Compute the price impact of a swap as a percentage (0-100).
 * Price impact = 1 - (effective_price / spot_price).
 */
export function computePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeNum: bigint,
  feeDenom: bigint,
): number {
  if (reserveIn <= 0n || reserveOut <= 0n || amountIn <= 0n) {
    return 0;
  }

  // Spot price: how much output per 1 unit of input (as ratio)
  const spotPriceNum = reserveOut;
  const spotPriceDenom = reserveIn;

  // Effective price: amountOut / amountIn
  const amountOut = getInputPrice(feeNum, feeDenom, amountIn, reserveIn, reserveOut);
  if (amountOut === 0n) {
    return 100;
  }

  // Price impact = 1 - (amountOut * reserveIn) / (amountIn * reserveOut)
  // Using cross multiplication for precision
  const effectiveNum = amountOut * spotPriceDenom;
  const effectiveDenom = amountIn * spotPriceNum;

  // impact = (1 - effectiveNum/effectiveDenom) * 100
  const impact = (1 - Number(effectiveNum) / Number(effectiveDenom)) * 100;
  return Math.max(0, impact);
}

/**
 * Compute minimum received amount after applying slippage tolerance.
 * @param amountOut Expected output amount.
 * @param slippageBps Slippage tolerance in basis points (e.g., 50 = 0.5%).
 */
export function computeMinimumReceived(amountOut: bigint, slippageBps: bigint): bigint {
  if (slippageBps < 0n || slippageBps > 10000n) {
    throw new Error("slippage must be between 0 and 10000 bps");
  }
  return (amountOut * (10000n - slippageBps)) / 10000n;
}

/**
 * Compute the spot price of a token in terms of LORDS.
 * Returns token price as LORDS per token (as a floating point number).
 */
export function computeSpotPrice(lordsReserve: bigint, tokenReserve: bigint): number {
  if (tokenReserve === 0n) {
    return 0;
  }
  return Number(lordsReserve) / Number(tokenReserve);
}
