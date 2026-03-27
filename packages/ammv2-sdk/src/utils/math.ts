import type { PairSummary, PathQuote } from "../types";

export const DEFAULT_FEE_AMOUNT = 997n;
export const THOUSAND = 1000n;

export function sortTokenPair(tokenA: string, tokenB: string): [string, string] {
  if (tokenA === tokenB) {
    throw new Error("token path cannot repeat the same address");
  }

  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

export function toPairKey(tokenA: string, tokenB: string): string {
  const [token0, token1] = sortTokenPair(tokenA, tokenB);
  return `${token0.toLowerCase()}:${token1.toLowerCase()}`;
}

export function buildPairsByTokenPair(pairs: PairSummary[]): Record<string, PairSummary> {
  return Object.fromEntries(pairs.map((pair) => [toPairKey(pair.token0Address, pair.token1Address), pair]));
}

export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, feeAmount: bigint): bigint {
  if (amountIn <= 0n) {
    throw new Error("amountIn must be positive");
  }
  if (reserveIn <= 0n || reserveOut <= 0n) {
    throw new Error("reserves must be positive");
  }
  if (feeAmount <= 0n || feeAmount > THOUSAND) {
    throw new Error("feeAmount must be between 1 and 1000");
  }

  const amountInWithFee = amountIn * feeAmount;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * THOUSAND + amountInWithFee;

  return numerator / denominator;
}

export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint, feeAmount: bigint): bigint {
  if (amountOut <= 0n) {
    throw new Error("amountOut must be positive");
  }
  if (reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
    throw new Error("insufficient liquidity");
  }
  if (feeAmount <= 0n || feeAmount > THOUSAND) {
    throw new Error("feeAmount must be between 1 and 1000");
  }

  const numerator = reserveIn * amountOut * THOUSAND;
  const denominator = (reserveOut - amountOut) * feeAmount;

  return numerator / denominator + 1n;
}

export function quoteExactIn(
  path: string[],
  amountIn: bigint,
  pairsByTokenPair: Record<string, PairSummary> | Map<string, PairSummary>,
): PathQuote {
  if (path.length < 2) {
    throw new Error("path must contain at least two tokens");
  }

  const amounts = [amountIn];
  const pairAddresses: string[] = [];
  let currentAmount = amountIn;

  for (let index = 0; index < path.length - 1; index += 1) {
    const tokenIn = path[index];
    const tokenOut = path[index + 1];
    const pair = resolvePair(pairsByTokenPair, tokenIn, tokenOut);
    const [reserveIn, reserveOut] = resolveReserves(pair, tokenIn, tokenOut);

    currentAmount = getAmountOut(currentAmount, reserveIn, reserveOut, pair.feeAmount || DEFAULT_FEE_AMOUNT);
    pairAddresses.push(pair.pairAddress);
    amounts.push(currentAmount);
  }

  return {
    path,
    pairAddresses,
    amounts,
    amountIn,
    amountOut: currentAmount,
  };
}

export function quoteExactOut(
  path: string[],
  amountOut: bigint,
  pairsByTokenPair: Record<string, PairSummary> | Map<string, PairSummary>,
): PathQuote {
  if (path.length < 2) {
    throw new Error("path must contain at least two tokens");
  }

  const amounts = new Array<bigint>(path.length);
  const pairAddresses = new Array<string>(path.length - 1);
  amounts[path.length - 1] = amountOut;
  let currentAmount = amountOut;

  for (let index = path.length - 2; index >= 0; index -= 1) {
    const tokenIn = path[index];
    const tokenOut = path[index + 1];
    const pair = resolvePair(pairsByTokenPair, tokenIn, tokenOut);
    const [reserveIn, reserveOut] = resolveReserves(pair, tokenIn, tokenOut);

    currentAmount = getAmountIn(currentAmount, reserveIn, reserveOut, pair.feeAmount || DEFAULT_FEE_AMOUNT);
    pairAddresses[index] = pair.pairAddress;
    amounts[index] = currentAmount;
  }

  return {
    path,
    pairAddresses,
    amounts,
    amountIn: amounts[0],
    amountOut,
  };
}

function resolvePair(
  pairsByTokenPair: Record<string, PairSummary> | Map<string, PairSummary>,
  tokenIn: string,
  tokenOut: string,
): PairSummary {
  const key = toPairKey(tokenIn, tokenOut);
  const pair = pairsByTokenPair instanceof Map ? pairsByTokenPair.get(key) : pairsByTokenPair[key];

  if (!pair) {
    throw new Error(`missing pair for ${tokenIn} -> ${tokenOut}`);
  }

  return pair;
}

function resolveReserves(pair: PairSummary, tokenIn: string, tokenOut: string): [bigint, bigint] {
  if (pair.token0Address === tokenIn && pair.token1Address === tokenOut) {
    return [pair.reserve0, pair.reserve1];
  }

  if (pair.token0Address === tokenOut && pair.token1Address === tokenIn) {
    return [pair.reserve1, pair.reserve0];
  }

  throw new Error(`pair ${pair.pairAddress} does not match ${tokenIn} -> ${tokenOut}`);
}
