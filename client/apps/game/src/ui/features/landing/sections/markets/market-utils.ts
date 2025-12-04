import { shortString, uint256, type Uint256 } from "starknet";

export type MarketServerStatus = "registration" | "started" | "ended";

export const decodePaddedFeltAscii = (hex: string): string => {
  try {
    if (!hex) return "";
    const value = hex.startsWith("0x") || hex.startsWith("0X") ? hex.slice(2) : hex;
    if (!value || value === "0") return "";

    try {
      const decoded = shortString.decodeShortString(BigInt(`0x${value}`).toString());
      if (decoded.trim().length > 0) return decoded;
    } catch {
      // fall back to manual decode
    }

    let cursor = 0;
    while (cursor + 1 < value.length && value.slice(cursor, cursor + 2) === "00") {
      cursor += 2;
    }

    let out = "";
    for (; cursor + 1 < value.length; cursor += 2) {
      const byte = parseInt(value.slice(cursor, cursor + 2), 16);
      if (byte !== 0) out += String.fromCharCode(byte);
    }
    return out;
  } catch {
    return "";
  }
};

export const parseMaybeHexToNumber = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
      try {
        return Number(BigInt(trimmed));
      } catch {
        return null;
      }
    }
    const asNum = Number(trimmed);
    return Number.isFinite(asNum) ? asNum : null;
  }

  if (typeof v === "bigint") {
    return Number(v);
  }

  return null;
};

export const normalizeHex = (value: string | number | bigint): string => {
  const bigintValue = typeof value === "string" ? BigInt(value) : BigInt(value);
  return `0x${bigintValue.toString(16)}`;
};

export const addressToUint256 = (address: string): Uint256 => {
  const normalized = normalizeHex(address);
  const bn = BigInt(normalized);
  const mask128 = (1n << 128n) - 1n;
  const low = bn & mask128;
  const high = bn >> 128n;

  return {
    low: `0x${low.toString(16)}`,
    high: `0x${high.toString(16)}`,
  };
};

export const parseLordsToBaseUnits = (value: string, decimals = 18): bigint | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d*(\.\d*)?$/.test(trimmed)) return null;

  const [wholeRaw, fractionRaw = ""] = trimmed.split(".");
  const whole = wholeRaw ? BigInt(wholeRaw) : 0n;
  const paddedFraction = (fractionRaw + "0".repeat(decimals)).slice(0, decimals);
  const fraction = paddedFraction ? BigInt(paddedFraction) : 0n;

  return whole * 10n ** BigInt(decimals) + fraction;
};

export const parseLordsToUint256 = (value: string): Uint256 | null => {
  const base = parseLordsToBaseUnits(value);
  if (base == null) return null;
  return uint256.bnToUint256(base);
};

export const formatTimestamp = (value: number | null): string => {
  if (!value) return "Not available";
  return new Date(value * 1000).toLocaleString();
};

export const deriveServerStatus = (
  startAt: number | null,
  endAt: number | null,
  nowSec: number,
): MarketServerStatus => {
  if (startAt == null || nowSec < startAt) return "registration";
  if (endAt != null && endAt !== 0 && nowSec >= endAt) return "ended";
  return "started";
};

export const stringToHexData = (value: string): { hex: string; length: number } => {
  if (!value) return { hex: "0x00", length: 0 };
  const hex = `0x${Array.from(value)
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("")}`;
  return { hex, length: value.length };
};
