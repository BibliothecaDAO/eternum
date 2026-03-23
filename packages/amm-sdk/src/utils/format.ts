const DEFAULT_DECIMALS = 18;

/**
 * Format a raw token amount (bigint) to a human-readable string.
 * E.g., 1000000000000000000n with 18 decimals -> "1.0"
 */
export function formatTokenAmount(amount: bigint, decimals: number = DEFAULT_DECIMALS): string {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = amount / divisor;
  const fractionalPart = amount % divisor;

  if (fractionalPart === 0n) {
    return wholePart.toString();
  }

  // Pad the fractional part to the full decimal width
  const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
  // Trim trailing zeros
  const trimmed = fractionalStr.replace(/0+$/, "");

  return `${wholePart}.${trimmed}`;
}

/**
 * Parse a human-readable token amount string to a raw bigint.
 * E.g., "1.5" with 18 decimals -> 1500000000000000000n
 */
export function parseTokenAmount(amount: string, decimals: number = DEFAULT_DECIMALS): bigint {
  const parts = amount.split(".");
  const wholePart = BigInt(parts[0] || "0");

  if (parts.length === 1 || !parts[1]) {
    return wholePart * 10n ** BigInt(decimals);
  }

  let fractionalStr = parts[1];
  if (fractionalStr.length > decimals) {
    // Truncate to max decimals
    fractionalStr = fractionalStr.slice(0, decimals);
  } else {
    // Pad to full decimal width
    fractionalStr = fractionalStr.padEnd(decimals, "0");
  }

  const fractionalPart = BigInt(fractionalStr);
  return wholePart * 10n ** BigInt(decimals) + fractionalPart;
}
