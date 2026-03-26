import { MINIMUM_LIQUIDITY } from "../constants";

export function quote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (amountA <= 0n) {
    throw new Error("insufficient amount");
  }
  if (reserveA <= 0n || reserveB <= 0n) {
    throw new Error("insufficient liquidity");
  }

  return (amountA * reserveB) / reserveA;
}

export function computeInitialLpMint(amountAAdded: bigint, amountBAdded: bigint): bigint {
  if (amountAAdded <= 0n) {
    throw new Error("insufficient token A amount");
  }
  if (amountBAdded <= 0n) {
    throw new Error("insufficient token B amount");
  }

  const sqrtLiquidity = sqrtBigInt(amountAAdded * amountBAdded);
  if (sqrtLiquidity <= MINIMUM_LIQUIDITY) {
    throw new Error("insufficient initial liquidity");
  }

  return sqrtLiquidity - MINIMUM_LIQUIDITY;
}

export function computeAddLiquidity(
  amountADesired: bigint,
  amountBDesired: bigint,
  reserveA: bigint,
  reserveB: bigint,
): { amountAUsed: bigint; amountBUsed: bigint } {
  if (reserveA === 0n && reserveB === 0n) {
    if (amountADesired <= 0n) {
      throw new Error("insufficient token A amount");
    }
    if (amountBDesired <= 0n) {
      throw new Error("insufficient token B amount");
    }

    return {
      amountAUsed: amountADesired,
      amountBUsed: amountBDesired,
    };
  }

  const amountBOptimal = quote(amountADesired, reserveA, reserveB);
  if (amountBOptimal <= amountBDesired) {
    return {
      amountAUsed: amountADesired,
      amountBUsed: amountBOptimal,
    };
  }

  const amountAOptimal = quote(amountBDesired, reserveB, reserveA);
  if (amountAOptimal > amountADesired) {
    throw new Error("insufficient token A amount");
  }

  return {
    amountAUsed: amountAOptimal,
    amountBUsed: amountBDesired,
  };
}

export function computeLpMint(amountAAdded: bigint, reserveA: bigint, totalLpSupply: bigint): bigint {
  if (totalLpSupply === 0n) {
    if (amountAAdded <= MINIMUM_LIQUIDITY) {
      throw new Error("insufficient initial liquidity");
    }

    return amountAAdded - MINIMUM_LIQUIDITY;
  }

  return (amountAAdded * totalLpSupply) / reserveA;
}

export function computeLpBurn(
  lpAmount: bigint,
  reserveA: bigint,
  reserveB: bigint,
  totalLpSupply: bigint,
): { amountAOut: bigint; amountBOut: bigint } {
  if (lpAmount <= 0n) {
    throw new Error("insufficient lp amount");
  }
  if (lpAmount > totalLpSupply) {
    throw new Error("lp amount exceeds supply");
  }

  return {
    amountAOut: (lpAmount * reserveA) / totalLpSupply,
    amountBOut: (lpAmount * reserveB) / totalLpSupply,
  };
}

function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) {
    throw new Error("square root requires a non-negative value");
  }

  if (value < 2n) {
    return value;
  }

  let current = value;
  let next = (value >> 1n) + 1n;

  while (next < current) {
    current = next;
    next = (value / next + next) >> 1n;
  }

  return current;
}
