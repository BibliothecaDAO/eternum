import { afterEach, describe, expect, it, vi } from "vitest";

import { avnuLordsWeiFor, avnuUsdPrices, LORDS_ADDRESS } from "./avnu";

afterEach(() => vi.useRealTimers());

const answering = (body: unknown, status = 200) => {
  const asked: { url: string; init?: RequestInit }[] = [];
  const get = (async (url: string, init?: RequestInit) => {
    asked.push({ url: String(url), init });
    return Response.json(body, { status });
  }) as typeof fetch;
  return { get, asked };
};

const USDC =
  "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";
/** A complete answer as AVNU gives it for $10 (shortened to one route): 3,276.15 LORDS sold for 10 USDC. */
const quote = (overrides: Record<string, unknown> = {}) => ({
  quoteId: "6467d1eb-095e-4ed5-bd76-35ab33b5e157",
  sellTokenAddress:
    "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  sellAmount: "0xb199c205f0ac280000",
  sellAmountInUsd: 10.262713,
  buyTokenAddress:
    "0x53c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
  buyAmount: "0x989680",
  buyAmountInUsd: 9.99605,
  fee: { feeToken: USDC, avnuFees: "0x0", integratorFees: "0x0" },
  chainId: "0x534e5f4d41494e",
  blockNumber: "0x113b1e3",
  expiry: null,
  routes: [{ name: "Ekubo", percent: 1 }],
  ...overrides,
});
const NO_QUOTE = "no LORDS quote";

describe("AVNU quote", () => {
  it("returns the LORDS wei of a complete answer that buys exactly the dollars asked", async () => {
    const { get, asked } = answering([quote()]);
    expect(await avnuLordsWeiFor(1_000, get)).toBe(0xb199c205f0ac280000n);
    const url = new URL(asked[0]!.url);
    expect(url.origin + url.pathname).toBe(
      "https://starknet.api.avnu.fi/swap/v3/quotes",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sellTokenAddress: LORDS_ADDRESS,
      buyTokenAddress: USDC,
      buyAmount: "0x989680",
      size: "1",
    });
    expect(asked[0]!.init?.redirect).toBe("manual");
  });

  it("refuses every answer that does not buy the dollars asked through a route", async () => {
    const refused: unknown[] = [
      [],
      {},
      { "0": quote() },
      [null],
      [quote({ sellAmount: "0x0" })],
      [quote({ sellAmount: "-1" })],
      [quote({ sellAmount: undefined })],
      [{ sellAmount: "0x1", buyAmount: "0x0", routes: [] }],
      [quote({ buyAmount: "0x989681" })],
      [quote({ buyAmount: undefined })],
      [quote({ buyTokenAddress: LORDS_ADDRESS })],
      [quote({ sellTokenAddress: USDC })],
      [quote({ chainId: "0x534e5f5345504f4c4941" })],
      [quote({ routes: [] })],
      [quote({ routes: undefined })],
      [quote({ routes: [null] })],
      [quote({ routes: [{}] })],
      [quote({ routes: [{ name: "Ekubo", percent: 0 }] })],
      [quote({ routes: [{ name: "Ekubo", percent: "1" }] })],
      [quote({ routes: [{ name: "", percent: 1 }] })],
      [quote({ routes: [{ name: "Ekubo", percent: 1 }, null] })],
    ];
    for (const body of refused)
      await expect(avnuLordsWeiFor(1_000, answering(body).get)).rejects.toThrow(
        NO_QUOTE,
      );
  });

  it("refuses an error status and a redirect", async () => {
    await expect(
      avnuLordsWeiFor(1_000, answering({}, 429).get),
    ).rejects.toThrow("429");
    await expect(
      avnuLordsWeiFor(1_000, answering([quote()], 302).get),
    ).rejects.toThrow("302");
  });

  it("gives no amount when the answer stalls, in its headers or in its body", async () => {
    vi.useFakeTimers();
    const headerStall = (() => new Promise(() => undefined)) as typeof fetch;
    const bodyStall = (async () => ({
      ok: true,
      json: () => new Promise(() => undefined),
    })) as unknown as typeof fetch;
    for (const get of [headerStall, bodyStall]) {
      const settled = expect(avnuLordsWeiFor(1_000, get)).rejects.toThrow(
        "no answer in 10000 ms",
      );
      await vi.advanceTimersByTimeAsync(10_000);
      await settled;
    }
  });
});

describe("AVNU prices", () => {
  it("prices each token in dollars from its Starknet market, matching addresses without their leading zeros", async () => {
    const { get, asked } = answering([
      {
        address:
          "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
        starknetMarket: { usd: 0.0031 },
      },
      {
        address:
          "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        starknetMarket: { usd: 2435.5 },
      },
    ]);
    const eth =
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";
    expect(await avnuUsdPrices([LORDS_ADDRESS, eth], get)).toEqual({
      [LORDS_ADDRESS]: 0.0031,
      [eth]: 2435.5,
    });
    expect(asked[0]!.url).toBe(
      "https://starknet.impulse.avnu.fi/v3/tokens/prices",
    );
    expect(JSON.parse(String(asked[0]!.init?.body))).toEqual({
      tokens: [LORDS_ADDRESS, eth],
    });
  });

  it("throws when a token has no price", async () => {
    await expect(
      avnuUsdPrices([LORDS_ADDRESS], answering([]).get),
    ).rejects.toThrow("no price");
  });
});
