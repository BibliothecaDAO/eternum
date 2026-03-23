/**
 * AMM math module — constant product (x * y = k) formulas.
 * Ported from contracts/amm/src/math.cairo with u256 -> bigint.
 */

/**
 * Given an input amount of one token, compute how much of the other token you receive.
 * Fee is deducted from input before calculation.
 *
 * Formula: output = (input_after_fee * output_reserve) / (input_reserve + input_after_fee)
 */
export function getInputPrice(
  feeNum: bigint,
  feeDenom: bigint,
  inputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
): bigint {
  if (inputReserve <= 0n || outputReserve <= 0n) {
    throw new Error("reserves must be > zero");
  }
  if (inputAmount <= 0n) {
    throw new Error("input amount must be > zero");
  }

  const inputAmountAfterFee = (inputAmount * (feeDenom - feeNum)) / feeDenom;
  const numerator = inputAmountAfterFee * outputReserve;
  const denominator = inputReserve + inputAmountAfterFee;

  return numerator / denominator;
}

/**
 * Given a desired output amount, compute how much input is required.
 * Rounds up (+1) to ensure the pool is never shortchanged.
 *
 * Formula: input = (input_reserve * output * fee_denom) / ((output_reserve - output) * (fee_denom - fee_num)) + 1
 */
export function getOutputPrice(
  feeNum: bigint,
  feeDenom: bigint,
  outputAmount: bigint,
  inputReserve: bigint,
  outputReserve: bigint,
): bigint {
  if (inputReserve <= 0n || outputReserve <= 0n) {
    throw new Error("reserves must be > zero");
  }
  if (outputAmount >= outputReserve) {
    throw new Error("output exceeds reserve");
  }
  if (outputAmount <= 0n) {
    throw new Error("output amount must be > zero");
  }

  const numerator = inputReserve * outputAmount * feeDenom;
  const denominator = (outputReserve - outputAmount) * (feeDenom - feeNum);

  return numerator / denominator + 1n;
}

/**
 * Proportional quote: given amount_a of token A, how much of token B maintains the ratio?
 * Used for computing optimal LP deposit amounts.
 */
export function quote(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (amountA <= 0n) {
    throw new Error("insufficient amount");
  }
  if (reserveA <= 0n || reserveB <= 0n) {
    throw new Error("insufficient liquidity");
  }

  return (amountA * reserveB) / reserveA;
}

/**
 * Compute optimal amounts for adding liquidity, maintaining pool ratio.
 * Returns { lordsUsed, tokenUsed }.
 */
export function computeAddLiquidity(
  lordsDesired: bigint,
  tokenDesired: bigint,
  lordsReserve: bigint,
  tokenReserve: bigint,
): { lordsUsed: bigint; tokenUsed: bigint } {
  if (lordsReserve === 0n && tokenReserve === 0n) {
    if (lordsDesired <= 0n) {
      throw new Error("insufficient lords amount");
    }
    if (tokenDesired <= 0n) {
      throw new Error("insufficient token amount");
    }
    return { lordsUsed: lordsDesired, tokenUsed: tokenDesired };
  }

  const tokenOptimal = quote(lordsDesired, lordsReserve, tokenReserve);
  if (tokenOptimal <= tokenDesired) {
    return { lordsUsed: lordsDesired, tokenUsed: tokenOptimal };
  }

  const lordsOptimal = quote(tokenDesired, tokenReserve, lordsReserve);
  if (lordsOptimal > lordsDesired) {
    throw new Error("insufficient lords amount");
  }
  return { lordsUsed: lordsOptimal, tokenUsed: tokenDesired };
}

/**
 * Compute LP tokens to mint for a given lords deposit.
 * First depositor: lp = lords_amount.
 * Subsequent: lp = (lords_added * total_supply) / lords_reserve.
 */
export function computeLpMint(lordsAdded: bigint, lordsReserve: bigint, totalLpSupply: bigint): bigint {
  if (totalLpSupply === 0n) {
    return lordsAdded;
  }
  return (lordsAdded * totalLpSupply) / lordsReserve;
}

/**
 * Compute token payouts when burning LP tokens.
 * Returns { lordsOut, tokenOut }.
 */
export function computeLpBurn(
  lpAmount: bigint,
  lordsReserve: bigint,
  tokenReserve: bigint,
  totalLpSupply: bigint,
): { lordsOut: bigint; tokenOut: bigint } {
  if (lpAmount <= 0n) {
    throw new Error("insufficient lp amount");
  }
  if (lpAmount > totalLpSupply) {
    throw new Error("lp amount exceeds supply");
  }

  const lordsOut = (lpAmount * lordsReserve) / totalLpSupply;
  const tokenOut = (lpAmount * tokenReserve) / totalLpSupply;

  return { lordsOut, tokenOut };
}
