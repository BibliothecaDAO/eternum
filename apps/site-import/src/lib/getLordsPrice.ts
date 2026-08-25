export interface LordsTokenInfo {
  address: string;
  decimals: string;
  symbol: string;
  name: string;
  price?: {
    rate: string;
    diff7d: string;
    marketCapUsd: string;
    volume24h: string;
  };
}

interface DexscreenerPair {
  baseToken?: {
    address?: string;
    symbol?: string;
    name?: string;
  };
  priceUsd?: string;
  priceChange?: {
    h24?: number;
    d7?: number;
  };
  volume?: {
    h24?: number;
  };
  marketCap?: number;
  fdv?: number;
}

interface DexscreenerPairResponse {
  pair?: DexscreenerPair | null;
  pairs?: DexscreenerPair[] | null;
}

const LORDS_DEXSCREENER_PAIR_ID =
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49-0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7-3402823669209384634633746074317682114-19802-0x0";

const LORDS_DEXSCREENER_API_URL =
  `https://api.dexscreener.com/latest/dex/pairs/starknet/${LORDS_DEXSCREENER_PAIR_ID}`;

const LORDS_TOKEN_ADDRESS =
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";

export async function getLordsInfo(): Promise<LordsTokenInfo> {
  const response = await fetch(LORDS_DEXSCREENER_API_URL, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Dexscreener LORDS price request failed: ${response.status}`);
  }

  const data = (await response.json()) as DexscreenerPairResponse;
  const pair = data.pair ?? data.pairs?.[0] ?? null;

  if (!pair?.priceUsd) {
    throw new Error("Dexscreener LORDS price response did not include priceUsd");
  }

  const priceUsd = pair.priceUsd;
  const marketCap = pair.marketCap ?? pair.fdv ?? 0;

  return {
    address: pair.baseToken?.address ?? LORDS_TOKEN_ADDRESS,
    decimals: "18",
    symbol: pair.baseToken?.symbol ?? "LORDS",
    name: pair.baseToken?.name ?? "Lords",
    price: {
      rate: priceUsd,
      diff7d: pair.priceChange?.d7?.toString() ?? "0",
      marketCapUsd: marketCap.toString(),
      volume24h: pair.volume?.h24?.toString() ?? "0",
    },
  };
}
