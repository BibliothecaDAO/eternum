import { afterEach, expect, it, vi } from "vitest";

import { quoteLords } from "./lords-price";

afterEach(() => vi.restoreAllMocks());

const WEI = 10n ** 18n;

it("prices dollars in whole LORDS rounded up to 5, from the quote read at the moment it is asked", async () => {
  const read = vi
    .fn<(cents: number) => Promise<bigint>>()
    .mockResolvedValueOnce(2_749n * WEI + WEI / 2n)
    .mockResolvedValueOnce(2_000n * WEI);
  // 2,749.5 LORDS round up to 2,750; an exact 2,000 stays: nothing is kept between asks.
  expect(await quoteLords(1_000, read)).toBe(2_750);
  expect(await quoteLords(1_000, read)).toBe(2_000);
  expect(read.mock.calls).toEqual([[1_000], [1_000]]);
});

it("offers no amount while the market cannot quote or answers an amount that is not one", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(await quoteLords(1_000, () => Promise.reject(new Error("AVNU: 429")))).toBeNull();
  expect(await quoteLords(1_000, async () => 0n)).toBeNull();
});

it("offers no amount for a quote a number cannot hold exactly", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(await quoteLords(1_000, async () => 10n ** 400n)).toBeNull();
});
