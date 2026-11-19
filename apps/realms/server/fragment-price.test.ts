import { expect, it, vi } from "vitest";

import type { IdentityAuth } from "./auth";
import { handleFragmentPrice } from "./fragment-price";
import type { LordsQuoteReader } from "./lords-price";
import type { ShopAccess } from "./shop-game";

const GAME = "chain=0x1&game=1";
const market =
  (usdPerLords: number): LordsQuoteReader =>
  async (cents) =>
    BigInt(Math.round((cents / 100 / usdPerLords) * 1e6)) * 10n ** 12n;
const marketDown: LordsQuoteReader = () => Promise.reject(new Error("AVNU: 429"));
const seated: ShopAccess = async () => true;
const signedIn = (realmsId: string | null) =>
  ({ api: { getSession: async () => (realmsId ? { user: { realmsId } } : null) } }) as unknown as IdentityAuth;

const ask = async (
  query: string,
  options: { realmsId?: string | null; access?: ShopAccess; market?: LordsQuoteReader },
) => {
  const response = await handleFragmentPrice(
    new Request(`https://realms.test/api/shop/fragments?${query}`),
    signedIn(options.realmsId === undefined ? "0xa1" : options.realmsId),
    { access: options.access ?? seated, readLordsQuote: options.market ?? market(0.003637) },
  );
  return [response.status, await response.json()];
};

it("prices Fragments at a cent each in LORDS from the market as it is asked, rounded up to 5", async () => {
  expect(await ask(`${GAME}&fragments=1000`, {})).toEqual([200, { fragments: 1_000, cents: 1_000, lords: 2_750 }]);
  expect(await ask(`${GAME}&fragments=100`, {})).toEqual([200, { fragments: 100, cents: 100, lords: 275 }]);
  expect(await ask(`${GAME}&fragments=100`, { market: market(0.005) })).toEqual([
    200,
    { fragments: 100, cents: 100, lords: 200 },
  ]);
});

it("offers no LORDS amount while the market cannot quote", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(await ask(`${GAME}&fragments=100`, { market: marketDown })).toEqual([
    200,
    { fragments: 100, cents: 100, lords: null },
  ]);
});

it("sells 100 Fragments or more, only to a player of a running Frontier game the request names", async () => {
  expect(await ask(`${GAME}&fragments=99`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(`${GAME}&fragments=150.5`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(`${GAME}`, {})).toEqual([400, { error: "invalid_fragments" }]);
  expect(await ask(`${GAME}&fragments=100`, { access: async () => false })).toEqual([
    404,
    { error: "no_shop_outside_a_frontier_game" },
  ]);
  expect(await ask("fragments=100", {})).toEqual([400, { error: "invalid_game" }]);
  expect((await ask(`${GAME}&fragments=100`, { realmsId: null }))[0]).toBe(401);
});
