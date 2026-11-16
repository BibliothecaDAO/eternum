import { lordsFor } from "@bibliothecadao/types";

/** LORDS's price in dollars, from the market; throws when the market cannot say. */
export type LordsPriceReader = () => Promise<number>;

/** The market's LORDS price in dollars (CoinGecko, as the comeback email reads it). */
export const marketLordsPrice =
  (get: typeof fetch = fetch): LordsPriceReader =>
  async () => {
    const response = await get("https://api.coingecko.com/api/v3/simple/price?ids=lords&vs_currencies=usd", {
      redirect: "manual",
    });
    if (!response.ok) throw new Error(`CoinGecko: ${response.status}`);
    const usd = ((await response.json()) as { lords?: { usd?: unknown } }).lords?.usd;
    if (typeof usd !== "number" || !(usd > 0)) throw new Error("CoinGecko: no LORDS price");
    return usd;
  };

/**
 * The one pricing of a LORDS amount: `cents` dollars-first, read from the market at the moment of asking, in whole LORDS
 * rounded up to a multiple of 5. Null while the market cannot say, so no amount is offered and no payment starts: there is
 * no stored price to fall back on.
 */
export const quoteLords = async (cents: number, read: LordsPriceReader): Promise<number | null> => {
  try {
    return lordsFor(cents, await read());
  } catch (error) {
    console.error("[lords price] the market could not be read; no LORDS amount is offered", error);
    return null;
  }
};
