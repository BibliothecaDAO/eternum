import {
  MINIMUM_LIQUIDITY,
  computeInitialLpMint,
  computeLpMint,
  formatTokenAmount,
  parseTokenAmount,
  quote,
  type Pool,
} from "@/services/amm";

export function isPoolAwaitingInitialLiquidity(pool: Pool | null): boolean {
  if (!pool) {
    return false;
  }

  return pool.totalLpSupply === 0n || (pool.lordsReserve === 0n && pool.tokenReserve === 0n);
}

export function resolveAutoFilledTokenAmount(pool: Pool | null, lordsAmount: number): number {
  if (!pool || lordsAmount <= 0 || isPoolAwaitingInitialLiquidity(pool)) {
    return 0;
  }

  try {
    const lordsBigint = parseTokenAmount(lordsAmount.toString());
    const tokenOptimal = quote(lordsBigint, pool.lordsReserve, pool.tokenReserve);
    return Number(formatTokenAmount(tokenOptimal));
  } catch {
    return 0;
  }
}

export function resolveLpTokensToMint(pool: Pool | null, lordsAmount: number, tokenAmount: number): string {
  const lpMinted = resolveLpMintAmount(pool, lordsAmount, tokenAmount);
  return lpMinted > 0n ? formatTokenAmount(lpMinted) : "0";
}

export function resolvePoolSharePercent(pool: Pool | null, lordsAmount: number, tokenAmount: number): number {
  const lpMinted = resolveLpMintAmount(pool, lordsAmount, tokenAmount);
  if (!pool || lpMinted <= 0n) {
    return 0;
  }

  const totalSupplyAfterDeposit = isPoolAwaitingInitialLiquidity(pool)
    ? lpMinted + MINIMUM_LIQUIDITY
    : pool.totalLpSupply + lpMinted;

  if (totalSupplyAfterDeposit <= 0n) {
    return 0;
  }

  const scaledPercent = (lpMinted * 10_000n) / totalSupplyAfterDeposit;
  return Number(scaledPercent) / 100;
}

function resolveLpMintAmount(pool: Pool | null, lordsAmount: number, tokenAmount: number): bigint {
  if (!pool || lordsAmount <= 0) {
    return 0n;
  }

  try {
    const lordsBigint = parseTokenAmount(lordsAmount.toString());

    if (isPoolAwaitingInitialLiquidity(pool)) {
      if (tokenAmount <= 0) {
        return 0n;
      }

      const tokenBigint = parseTokenAmount(tokenAmount.toString());
      return computeInitialLpMint(lordsBigint, tokenBigint);
    }

    return computeLpMint(lordsBigint, pool.lordsReserve, pool.totalLpSupply);
  } catch {
    return 0n;
  }
}
