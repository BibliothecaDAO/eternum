/**
 * Normalize a uint256 value from various formats to bigint
 */
export const normalizeUint256 = (value: unknown): bigint => {
  if (!value) return 0n;

  if (typeof value === "bigint") return value;

  if (Array.isArray(value)) {
    if (value.length === 2) {
      const [low, high] = value;
      return BigInt(low ?? 0) + (BigInt(high ?? 0) << 128n);
    }
    if (value.length === 1) {
      return BigInt(value[0] ?? 0);
    }
  }

  if (typeof value === "object" && value !== null) {
    const maybeUint = value as { low?: bigint | number | string; high?: bigint | number | string };
    if (maybeUint.low !== undefined && maybeUint.high !== undefined) {
      return BigInt(maybeUint.low) + (BigInt(maybeUint.high) << 128n);
    }
  }

  try {
    return BigInt(value as string);
  } catch (error) {
    console.warn("Failed to normalise uint256", value, error);
    return 0n;
  }
};

/**
 * Decode a padded felt ASCII hex string to a readable string
 */
export const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const h = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (h === "0") return "";

    // Skip leading 00 bytes
    let i = 0;
    while (i + 1 < h.length && h.slice(i, i + 2) === "00") i += 2;

    let out = "";
    for (; i + 1 < h.length; i += 2) {
      const byte = parseInt(h.slice(i, i + 2), 16);
      if (byte === 0) continue;
      out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
};

/**
 * Parse a value that might be hex or decimal to a number
 */
export const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    try {
      if (v.startsWith("0x") || v.startsWith("0X")) return Number(BigInt(v));
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }
  return null;
};
