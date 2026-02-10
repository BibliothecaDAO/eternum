const strip0x = (v: string) => (v.startsWith("0x") || v.startsWith("0X") ? v.slice(2) : v);
const leftPadHex = (hexWithout0x: string, width: number) => hexWithout0x.padStart(width, "0");

export const normalizeHex = (v: string) => {
  const body = strip0x(v).toLowerCase();
  const padded = leftPadHex(body, 64);
  return `0x${padded}`;
};

export const normalizeSelector = (v: string) => normalizeHex(v);

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
