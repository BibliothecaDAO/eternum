import { MAINNET_TOKENS } from "./tokens";

/** The one market source: AVNU, on Starknet mainnet. Nothing else is asked what a token is worth. */
const QUOTES_URL = "https://starknet.api.avnu.fi/swap/v3/quotes";
const BUILD_URL = "https://starknet.api.avnu.fi/swap/v3/build";
const PRICES_URL = "https://starknet.impulse.avnu.fi/v3/tokens/prices";

export const LORDS_ADDRESS = MAINNET_TOKENS.lords.address;
export const AVNU_ROUTER =
  "0x04270219d365d6b017231b52e92b3fb5d7c8378b05e9abc97724537a80e93b0f";
const USDC_ADDRESS = MAINNET_TOKENS.usdc.address;
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
  quoteId?: unknown;
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

export interface LordsPurchase {
  sellToken: string;
  lordsWei: bigint;
  taker: string;
  slippage: number;
}

export interface AvnuCall {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
}

export const avnuLordsPurchase = async (
  purchase: LordsPurchase,
  get: typeof fetch = fetch,
): Promise<{
  sellAmount: bigint;
  maxSellAmount: bigint;
  calls: AvnuCall[];
}> => {
  const quote = await lordsPurchaseQuote(purchase, get);
  const calls = await builtCalls(quote.quoteId, purchase, get);
  const maxSellAmount = maxSoldBy(calls, purchase);
  if (maxSellAmount === null || maxSellAmount < quote.sellAmount)
    throw new Error("AVNU: built calls are not the LORDS purchase asked");
  return { sellAmount: quote.sellAmount, maxSellAmount, calls };
};

const lordsPurchaseQuote = async (
  { sellToken, lordsWei, taker }: LordsPurchase,
  get: typeof fetch,
) => {
  const query = new URLSearchParams({
    sellTokenAddress: sellToken,
    buyTokenAddress: LORDS_ADDRESS,
    buyAmount: `0x${lordsWei.toString(16)}`,
    takerAddress: taker,
    size: "1",
  });
  const quotes = await fetchJson(get, `${QUOTES_URL}?${query}`);
  const quote = Array.isArray(quotes)
    ? (quotes[0] as Quote | undefined)
    : undefined;
  const sellAmount = hexAmount(quote?.sellAmount);
  if (
    typeof quote !== "object" ||
    quote === null ||
    typeof quote.quoteId !== "string" ||
    !isAddress(quote.sellTokenAddress, sellToken) ||
    !isAddress(quote.buyTokenAddress, LORDS_ADDRESS) ||
    hexAmount(quote.buyAmount) !== lordsWei ||
    quote.chainId !== MAINNET_CHAIN_ID ||
    !isUsableRoutes(quote.routes) ||
    sellAmount === null ||
    sellAmount <= 0n
  )
    throw new Error("AVNU: no quote buys the LORDS asked");
  return { quoteId: quote.quoteId, sellAmount };
};

const builtCalls = async (
  quoteId: string,
  { taker, slippage }: LordsPurchase,
  get: typeof fetch,
): Promise<AvnuCall[]> => {
  const built = (await fetchJson(get, BUILD_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      quoteId,
      takerAddress: taker,
      slippage,
      includeApprove: true,
    }),
  })) as { chainId?: unknown; calls?: unknown } | null;
  if (
    built?.chainId !== MAINNET_CHAIN_ID ||
    !Array.isArray(built.calls) ||
    !built.calls.every(isCall)
  )
    throw new Error("AVNU: built calls are not the LORDS purchase asked");
  return built.calls;
};

const isCall = (call: unknown): call is AvnuCall => {
  const { contractAddress, entrypoint, calldata } = (call ?? {}) as Record<
    string,
    unknown
  >;
  return (
    hexAmount(contractAddress) !== null &&
    typeof entrypoint === "string" &&
    Array.isArray(calldata) &&
    calldata.every((value) => hexAmount(value) !== null)
  );
};

const u256 = (low: string | undefined, high: string | undefined) =>
  low === undefined || high === undefined
    ? null
    : BigInt(low) + (BigInt(high) << 128n);

const maxSoldBy = (
  calls: readonly AvnuCall[],
  { sellToken, lordsWei, taker }: LordsPurchase,
): bigint | null => {
  const swaps = calls.filter((call) =>
    isAddress(call.contractAddress, AVNU_ROUTER),
  );
  const [swap] = swaps;
  if (swaps.length !== 1 || swap!.entrypoint !== "swap_exact_token_to")
    return null;
  const [sold, , , maxLow, maxHigh, bought, buyLow, buyHigh, beneficiary] =
    swap!.calldata;
  const max = u256(maxLow, maxHigh);
  const buysTheLordsAsked =
    isAddress(sold, sellToken) &&
    isAddress(bought, LORDS_ADDRESS) &&
    u256(buyLow, buyHigh) === lordsWei &&
    isAddress(beneficiary, taker);
  const approvesOnlyTheRouter = calls
    .filter((call) => call !== swap)
    .every(
      ({ contractAddress, entrypoint, calldata: [spender, low, high] }) =>
        isAddress(contractAddress, sellToken) &&
        entrypoint === "approve" &&
        isAddress(spender, AVNU_ROUTER) &&
        max !== null &&
        (u256(low, high) ?? max + 1n) <= max,
    );
  return buysTheLordsAsked && approvesOnlyTheRouter ? max : null;
};
