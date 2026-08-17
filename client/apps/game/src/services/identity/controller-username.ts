/**
 * Controller usernames are the canonical player identity (tester-gate D1).
 * Torii mirrors the Cartridge controllers registry, so arbitrary
 * address → username lookups are served by the world torii's `controllers`
 * table instead of the retired Slot global torii.
 */
import { getDefaultWorld } from "@/runtime/world/world-directory";

// The controllers table stores addresses as 0x + 64-char lowercase hex.
const toPaddedAddress = (address: string): string | null => {
  try {
    const value = BigInt(address);
    if (value === 0n) return null;
    return `0x${value.toString(16).padStart(64, "0")}`;
  } catch {
    return null;
  }
};

export const fetchControllerUsername = async (address: string): Promise<string | null> => {
  const padded = toPaddedAddress(address);
  if (!padded) return null;

  try {
    const query = `SELECT username FROM controllers WHERE address = '${padded}' LIMIT 1`;
    const url = `${getDefaultWorld().toriiBaseUrl}/sql?query=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const rows = (await response.json()) as { username?: string }[];
    const username = rows[0]?.username?.trim();
    return username || null;
  } catch {
    return null;
  }
};
