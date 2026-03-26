const DEFAULT_DECIMALS = 18;

export function formatTokenAmount(amount: bigint, decimals: number = DEFAULT_DECIMALS): string {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  const trimmed = fractionalStr.replace(/0+$/, "");

  return `${wholePart}.${trimmed}`;
}

export function parseTokenAmount(amount: string, decimals: number = DEFAULT_DECIMALS): bigint {
  const parts = amount.split(".");
  const wholePart = BigInt(parts[0] || "0");

  if (parts.length === 1 || !parts[1]) {
    return wholePart * 10n ** BigInt(decimals);
  }

  let fractionalStr = parts[1];
  if (fractionalStr.length > decimals) {
    fractionalStr = fractionalStr.slice(0, decimals);
  } else {
    fractionalStr = fractionalStr.padEnd(decimals, "0");
  }

  const fractionalPart = BigInt(fractionalStr);
  return wholePart * 10n ** BigInt(decimals) + fractionalPart;
}
