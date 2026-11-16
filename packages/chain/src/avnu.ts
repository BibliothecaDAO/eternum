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

const fetchJson = async (
  get: typeof fetch,
  url: string,
  init?: RequestInit,
): Promise<unknown> => {
  const response = await get(url, { ...init, redirect: "manual" });
  if (!response.ok)
    throw new Error(`AVNU ${new URL(url).pathname}: ${response.status}`);
  return response.json();
};

/**
 * What `cents` costs in LORDS wei right now: AVNU's quote to sell LORDS for exactly that many dollars of USDC. The
 * quote's price impact and fees are part of the amount, so paying it covers the dollars. Throws when AVNU has no quote.
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
  const quotes = (await fetchJson(get, `${QUOTES_URL}?${query}`)) as {
    sellAmount?: unknown;
  }[];
  const sellAmount = quotes[0]?.sellAmount;
  if (
    typeof sellAmount !== "string" ||
    !/^0x[0-9a-f]+$/i.test(sellAmount) ||
    BigInt(sellAmount) <= 0n
  )
    throw new Error("AVNU: no LORDS quote");
  return BigInt(sellAmount);
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
