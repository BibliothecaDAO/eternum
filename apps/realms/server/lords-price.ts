import { avnuLordsWeiFor } from "@realms-world/chain";
import { roundUpLords } from "@bibliothecadao/types";

/** The market's cost of an amount in LORDS wei, from AVNU; throws when it cannot quote. */
export type LordsQuoteReader = (cents: number) => Promise<bigint>;

/** AVNU, the one market source. */
export const avnuQuote: LordsQuoteReader = (cents) => avnuLordsWeiFor(cents);

/**
 * The one pricing of a LORDS amount: `cents` dollars-first, quoted by the market at the moment of asking, in whole LORDS
 * rounded up to a multiple of 5. Null while the market cannot quote, or quotes an amount a number cannot hold: no amount is
 * offered, and there is no stored price to fall back on.
 */
export const quoteLords = async (cents: number, read: LordsQuoteReader): Promise<number | null> => {
  try {
    return roundUpLords(await read(cents));
  } catch (error) {
    console.error("[lords price] the market could not quote; no LORDS amount is offered", error);
    return null;
  }
};
