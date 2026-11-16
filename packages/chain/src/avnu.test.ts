import { describe, expect, it } from "vitest";

import { avnuLordsWeiFor, avnuUsdPrices, LORDS_ADDRESS } from "./avnu";

const answering = (body: unknown, status = 200) => {
  const asked: { url: string; init?: RequestInit }[] = [];
  const get = (async (url: string, init?: RequestInit) => {
    asked.push({ url: String(url), init });
    return Response.json(body, { status });
  }) as typeof fetch;
  return { get, asked };
};

describe("AVNU", () => {
  it("quotes the LORDS that sell for exactly the dollars asked, including its impact and fees", async () => {
    const { get, asked } = answering([{ sellAmount: "0xb5e1d14cf6e6700000" }]);
    expect(await avnuLordsWeiFor(1_000, get)).toBe(0xb5e1d14cf6e6700000n);
    const url = new URL(asked[0]!.url);
    expect(url.origin + url.pathname).toBe(
      "https://starknet.api.avnu.fi/swap/v3/quotes",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      sellTokenAddress: LORDS_ADDRESS,
      buyTokenAddress:
        "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
      buyAmount: "0x989680",
      size: "1",
    });
    expect(asked[0]!.init?.redirect).toBe("manual");
  });

  it("refuses an answer that is not a quote", async () => {
    await expect(avnuLordsWeiFor(1_000, answering([]).get)).rejects.toThrow(
      "no LORDS quote",
    );
    await expect(
      avnuLordsWeiFor(1_000, answering([{ sellAmount: "0x0" }]).get),
    ).rejects.toThrow("no LORDS quote");
    await expect(
      avnuLordsWeiFor(1_000, answering({}, 429).get),
    ).rejects.toThrow("429");
  });

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
