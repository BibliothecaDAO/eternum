import { afterEach, expect, it, vi } from "vitest";

import { marketLordsPrice, quoteLords } from "./lords-price";

afterEach(() => vi.restoreAllMocks());

const answer = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;

it("reads the market's price and refuses an answer that is not one", async () => {
  expect(await marketLordsPrice(answer({ lords: { usd: 0.0036 } }))()).toBe(0.0036);
  await expect(marketLordsPrice(answer({ lords: { usd: 0 } }))()).rejects.toThrow("no LORDS price");
  await expect(marketLordsPrice(answer({}, 429))()).rejects.toThrow("429");
});

it("prices dollars in whole LORDS rounded up to 5, from the market read at the moment it is asked", async () => {
  const read = vi.fn<() => Promise<number>>().mockResolvedValueOnce(0.003637).mockResolvedValueOnce(0.005);
  // $10 is 2,749.5 LORDS at the first price; the same $10 is 2,000 at the second: nothing is kept between asks.
  expect(await quoteLords(1_000, read)).toBe(2_750);
  expect(await quoteLords(1_000, read)).toBe(2_000);
  expect(read).toHaveBeenCalledTimes(2);
});

it("offers no amount while the market cannot be read or answers a price that is not one", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(await quoteLords(1_000, () => Promise.reject(new Error("CoinGecko: 429")))).toBeNull();
  expect(await quoteLords(1_000, async () => 0)).toBeNull();
  expect(await quoteLords(1_000, async () => Number.NaN)).toBeNull();
});
