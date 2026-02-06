export function computeOutputAmount(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number,
  feeNum: number,
  feeDenom: number,
): number {
  if (inputAmount === 0) {
    return 0;
  }

  const effectiveInput = feeNum > 0 ? (inputAmount * (feeDenom - feeNum)) / feeDenom : inputAmount;

  return (effectiveInput * outputReserve) / (inputReserve + effectiveInput);
}

export function computeSlippage(
  inputAmount: number,
  inputReserve: number,
  outputReserve: number,
): number {
  if (inputAmount === 0) {
    return 0;
  }

  // Ideal output at spot price (no price impact)
  const spotPrice = outputReserve / inputReserve;
  const idealOutput = inputAmount * spotPrice;

  // Actual output from constant-product formula (no fee)
  const actualOutput = (inputAmount * outputReserve) / (inputReserve + inputAmount);

  // Slippage as percentage
  return ((idealOutput - actualOutput) / idealOutput) * 100;
}

export function computeMarketPrice(lordsReserve: number, resourceReserve: number): number {
  if (resourceReserve === 0) {
    return Infinity;
  }

  return lordsReserve / resourceReserve;
}
