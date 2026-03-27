import {
  computeAddLiquidity as computePairAddLiquidity,
  computeInitialLpMint as computePairInitialLpMint,
  computeLpBurn as computePairLpBurn,
  computeLpMint as computePairLpMint,
  formatTokenAmount,
  parseTokenAmount,
  quote as quotePairAmount,
} from "@bibliothecadao/ammv2-sdk";

export { formatTokenAmount, parseTokenAmount };

export function computeSpotPrice(lordsReserve: bigint, tokenReserve: bigint): number {
  if (lordsReserve <= 0n || tokenReserve <= 0n) {
    return 0;
  }

  return Number(lordsReserve) / Number(tokenReserve);
}

export function quote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  return quotePairAmount(amountA, reserveA, reserveB);
}

export function computeAddLiquidity(
  lordsDesired: bigint,
  tokenDesired: bigint,
  lordsReserve: bigint,
  tokenReserve: bigint,
): { lordsUsed: bigint; tokenUsed: bigint } {
  const optimalAmounts = computePairAddLiquidity(lordsDesired, tokenDesired, lordsReserve, tokenReserve);

  return {
    lordsUsed: optimalAmounts.amountAUsed,
    tokenUsed: optimalAmounts.amountBUsed,
  };
}

export function computeInitialLpMint(lordsAdded: bigint, tokenAdded: bigint): bigint {
  return computePairInitialLpMint(lordsAdded, tokenAdded);
}

export function computeLpMint(lordsAdded: bigint, lordsReserve: bigint, totalLpSupply: bigint): bigint {
  return computePairLpMint(lordsAdded, lordsReserve, totalLpSupply);
}

export function computeLpBurn(
  lpAmount: bigint,
  lordsReserve: bigint,
  tokenReserve: bigint,
  totalLpSupply: bigint,
): { lordsOut: bigint; tokenOut: bigint } {
  const outputs = computePairLpBurn(lpAmount, lordsReserve, tokenReserve, totalLpSupply);

  return {
    lordsOut: outputs.amountAOut,
    tokenOut: outputs.amountBOut,
  };
}
