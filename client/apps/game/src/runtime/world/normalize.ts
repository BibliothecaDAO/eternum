import type { Chain } from "@contracts";

// Hex helpers
export const strip0x = (v: string) => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);

export const toLowerHex = (v: string) => `0x${strip0x(v).toLowerCase()}`;

export const leftPadHex = (hexWithout0x: string, width: number) => hexWithout0x.padStart(width, "0");

// Normalize any hex to 0x + 64-char lowercase body
export const normalizeHex = (v: string) => {
  const body = strip0x(v).toLowerCase();
  const padded = leftPadHex(body, 64);
  return `0x${padded}`;
};

// Selector normalization equals normalizeHex
export const normalizeSelector = (v: string) => normalizeHex(v);

// Convert ASCII string to felt-hex, left-padded with zeros to 32 bytes (64 hex chars)
export const nameToPaddedFelt = (name: string) => {
  const bytes = new TextEncoder().encode(name);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  const padded = leftPadHex(hex, 64);
  return `0x${padded}`;
};

const RPC_VERSION_PATH = "/rpc/v0_9";

export const normalizeRpcUrl = (value: string) => {
  if (!value || value.includes("/rpc/")) return value;

  try {
    const url = new URL(value);
    if (!url.hostname.endsWith("cartridge.gg")) return value;

    const path = url.pathname.replace(/\/+$/, "");
    const isKatana = path.endsWith("/katana");
    const isStarknet = /\/starknet\/(mainnet|sepolia)$/i.test(path);

    if (isKatana || isStarknet) {
      url.pathname = `${path}${RPC_VERSION_PATH}`;
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
};

const isCartridgeUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.hostname.endsWith("cartridge.gg");
  } catch {
    return false;
  }
};

export const isRpcUrlCompatibleForChain = (chain: Chain, url: string) => {
  if (!url) return false;
  if (!isCartridgeUrl(url)) return true;

  const lower = url.toLowerCase();
  if (chain === "mainnet" || chain === "sepolia") {
    return lower.includes(`/x/starknet/${chain}`);
  }

  if (chain === "slot" || chain === "slottest") {
    return lower.includes("/katana");
  }

  return true;
};
