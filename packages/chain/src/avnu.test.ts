import { afterEach, describe, expect, it, vi } from "vitest";

import {
  avnuLordsPurchase,
  avnuLordsWeiFor,
  avnuUsdPrices,
  LORDS_ADDRESS,
} from "./avnu";
import builtPurchase from "./fixtures/avnu-lords-build.json";
import purchaseQuote from "./fixtures/avnu-lords-quote.json";

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

describe("AVNU LORDS purchase", () => {
  const STRK =
    "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
  const TAKER =
    "0x39f0fd8bec01515b543461fb41331cb5e6814c2343439e7f9e9c3dd1159f7c7";
  const purchase = {
    sellToken: STRK,
    lordsWei: 1_000n * 10n ** 18n,
    taker: TAKER,
    slippage: 0.01,
  };
  const NOT_ASKED = "not the LORDS purchase asked";

  const answering = (quotes: unknown, built: unknown) => {
    const asked: { url: string; init?: RequestInit }[] = [];
    const get = (async (url: string, init?: RequestInit) => {
      asked.push({ url: String(url), init });
      return Response.json(init?.method === "POST" ? built : quotes);
    }) as typeof fetch;
    return { get, asked };
  };
  const swapWith = (change: (calldata: string[]) => void) => {
    const calls = structuredClone(builtPurchase.calls);
    change(calls[1]!.calldata);
    return { ...builtPurchase, calls };
  };

  it("gives AVNU's own calls that buy exactly the LORDS asked for the taker, with the quoted and the most sold", async () => {
    const { get, asked } = answering([purchaseQuote], builtPurchase);
    const bought = await avnuLordsPurchase(purchase, get);
    expect(bought).toEqual({
      sellAmount: 0x5ac887faf1a640000n,
      maxSellAmount: 0x5bb0efbd7410df600n,
      calls: builtPurchase.calls,
    });
    expect(bought.calls.map(({ entrypoint }) => entrypoint)).toEqual([
      "approve",
      "swap_exact_token_to",
      "approve",
    ]);
    const url = new URL(asked[0]!.url);
    expect(url.origin + url.pathname).toBe(
      "https://starknet.api.avnu.fi/swap/v3/quotes",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sellTokenAddress: STRK,
      buyTokenAddress: LORDS_ADDRESS,
      buyAmount: "0x3635c9adc5dea00000",
      takerAddress: TAKER,
      size: "1",
    });
    expect(asked[1]!.url).toBe("https://starknet.api.avnu.fi/swap/v3/build");
    expect(JSON.parse(String(asked[1]!.init?.body))).toEqual({
      quoteId: purchaseQuote.quoteId,
      takerAddress: TAKER,
      slippage: 0.01,
      includeApprove: true,
    });
  });

  it("refuses a quote for another token, amount or chain, or with no route", async () => {
    const refused = [
      [],
      [{ ...purchaseQuote, sellTokenAddress: LORDS_ADDRESS }],
      [{ ...purchaseQuote, buyTokenAddress: STRK }],
      [{ ...purchaseQuote, buyAmount: "0x3635c9adc5dea00001" }],
      [{ ...purchaseQuote, chainId: "0x534e5f5345504f4c4941" }],
      [{ ...purchaseQuote, routes: [] }],
      [{ ...purchaseQuote, sellAmount: "0x0" }],
      [{ ...purchaseQuote, quoteId: undefined }],
    ];
    for (const quotes of refused)
      await expect(
        avnuLordsPurchase(purchase, answering(quotes, builtPurchase).get),
      ).rejects.toThrow("no quote buys the LORDS asked");
  });

  it("refuses built calls that buy something else, pay someone else, or touch anything but the sold token and AVNU's router", async () => {
    const [approve, swap, reset] = builtPurchase.calls;
    const refused = [
      { ...builtPurchase, chainId: "0x534e5f5345504f4c4941" },
      { ...builtPurchase, calls: [approve, reset] },
      { ...builtPurchase, calls: [approve, swap, swap] },
      { ...builtPurchase, calls: [approve, { ...swap, entrypoint: "swap" }] },
      {
        ...builtPurchase,
        calls: [swap, { ...approve, contractAddress: LORDS_ADDRESS }],
      },
      {
        ...builtPurchase,
        calls: [swap, { ...approve, entrypoint: "transfer" }],
      },
      {
        ...builtPurchase,
        calls: [swap, { ...approve, calldata: [TAKER, "0x1", "0x0"] }],
      },
      {
        ...builtPurchase,
        calls: [
          swap,
          { ...approve, calldata: [approve!.calldata[0], "0x0", "0x1"] },
        ],
      },
      swapWith((calldata) => (calldata[0] = LORDS_ADDRESS)),
      swapWith((calldata) => (calldata[5] = STRK)),
      swapWith((calldata) => (calldata[6] = "0x3635c9adc5dea00001")),
      swapWith((calldata) => (calldata[8] = "0x7a")),
      swapWith((calldata) => (calldata[3] = "0x1")),
      { ...builtPurchase, calls: "none" },
    ];
    for (const built of refused)
      await expect(
        avnuLordsPurchase(purchase, answering([purchaseQuote], built).get),
      ).rejects.toThrow(NOT_ASKED);
  });
});
