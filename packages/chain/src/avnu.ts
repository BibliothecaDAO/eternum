/** The one market source: AVNU, on Starknet mainnet. Nothing else is asked what a token is worth. */
const QUOTES_URL = "https://starknet.api.avnu.fi/swap/v3/quotes";
const PRICES_URL = "https://starknet.impulse.avnu.fi/v3/tokens/prices";

export const LORDS_ADDRESS =
  "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49";
const USDC_ADDRESS =
  "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
/** A cent in USDC's smallest unit (6 decimals). */
const USDC_PER_CENT = 10_000n;

const normalized = (address: string) => `0x${BigInt(address).toString(16)}`;

/** AVNU must answer within this, headers and body together; a stalled read is "no answer", never a pending one. */
const READ_DEADLINE_MS = 10_000;
/** Starknet mainnet, as AVNU names it in a quote. */
const MAINNET_CHAIN_ID = "0x534e5f4d41494e";

const fetchJson = async (
  get: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<unknown> => {
  const path = new URL(url).pathname;
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new Error(`AVNU ${path}: no answer in ${READ_DEADLINE_MS} ms`));
    }, READ_DEADLINE_MS);
  });
  const read = async () => {
    const response = await get(url, {
      ...init,
      redirect: "manual",
      signal: abort.signal,
    });
    if (!response.ok) throw new Error(`AVNU ${path}: ${response.status}`);
    return response.json();
  };
  try {
    return await Promise.race([read(), deadline]);
  } finally {
    clearTimeout(timer);
  }
};

const hexAmount = (value: unknown): bigint | null =>
  typeof value === "string" && /^0x[0-9a-f]+$/i.test(value)
    ? BigInt(value)
    : null;

const isAddress = (value: unknown, expected: string) =>
  hexAmount(value) !== null &&
  normalized(String(value)) === normalized(expected);

interface Quote {
  sellTokenAddress?: unknown;
  sellAmount?: unknown;
  buyTokenAddress?: unknown;
  buyAmount?: unknown;
  chainId?: unknown;
  routes?: unknown;
}

const isUsableRoute = (route: unknown): boolean => {
  if (typeof route !== "object" || route === null) return false;
  const { name, percent } = route as { name?: unknown; percent?: unknown };
  return (
    typeof name === "string" &&
    name !== "" &&
    typeof percent === "number" &&
    Number.isFinite(percent) &&
    percent > 0
  );
};

const isUsableRoutes = (routes: unknown): boolean =>
  Array.isArray(routes) && routes.length > 0 && routes.every(isUsableRoute);

/**
 * The LORDS wei of an answer that sells LORDS on Starknet mainnet for exactly `buyAmount` of USDC through at least one
 * route, or null: an answer that does not buy the dollars asked gives no amount.
 */
const lordsSoldFor = (quotes: unknown, buyAmount: bigint): bigint | null => {
  const quote = Array.isArray(quotes)
    ? (quotes[0] as Quote | undefined)
    : undefined;
  if (typeof quote !== "object" || quote === null) return null;
  const sellAmount = hexAmount(quote.sellAmount);
  const buysTheDollarsAsked =
    isAddress(quote.sellTokenAddress, LORDS_ADDRESS) &&
    isAddress(quote.buyTokenAddress, USDC_ADDRESS) &&
    hexAmount(quote.buyAmount) === buyAmount &&
    quote.chainId === MAINNET_CHAIN_ID &&
    isUsableRoutes(quote.routes);
  return buysTheDollarsAsked && sellAmount !== null && sellAmount > 0n
    ? sellAmount
    : null;
};

/**
 * What `cents` costs in LORDS wei right now: AVNU's quote to sell LORDS for exactly that many dollars of USDC. The
 * quote's price impact and fees are part of the amount, so paying it covers the dollars. Throws when AVNU has no quote
 * that buys exactly those dollars.
 */
export const avnuLordsWeiFor = async (
  cents: number,
  get: typeof fetch = fetch,
): Promise<bigint> => {
  const buyAmount = BigInt(cents) * USDC_PER_CENT;
  const query = new URLSearchParams({
    sellTokenAddress: LORDS_ADDRESS,
    buyTokenAddress: USDC_ADDRESS,
    buyAmount: `0x${buyAmount.toString(16)}`,
    size: "1",
  });
  const sold = lordsSoldFor(
    await fetchJson(get, `${QUOTES_URL}?${query}`),
    buyAmount,
  );
  if (sold === null)
    throw new Error("AVNU: no LORDS quote for the dollars asked");
  return sold;
};

/** What each token is worth in dollars on Starknet right now, by the address it was asked by. Throws on a missing price. */
export const avnuUsdPrices = async (
  addresses: readonly string[],
  get: typeof fetch = fetch,
): Promise<Record<string, number>> => {
  const rows = (await fetchJson(get, PRICES_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tokens: addresses }),
  })) as { address: string; starknetMarket?: { usd?: unknown } }[];
  const prices: Record<string, number> = {};
  for (const address of addresses) {
    const usd = rows.find(
      (row) => normalized(row.address) === normalized(address),
    )?.starknetMarket?.usd;
    if (typeof usd !== "number" || !(usd > 0))
      throw new Error(`AVNU: no price for ${address}`);
    prices[address] = usd;
  }
  return prices;
};
