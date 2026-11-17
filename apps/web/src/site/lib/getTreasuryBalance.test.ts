import { afterEach, expect, it, vi } from "vitest";

import { getTreasuryBalance } from "./getTreasuryBalance";
import { treasurySupply } from "./treasury-supply";

afterEach(() => vi.unstubAllGlobals());

const TOKENS = {
  LORDS: "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  ETH: "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  STRK: "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  EKUBO: "0x75afe6402ad5a5c20dd25e10ec3b3986acaa647b77e4ae24b0cbc9a54a27a87",
  SURVIVOR: "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b",
};
const PRICES = { LORDS: 0.5, ETH: 2_000, STRK: 0.25, EKUBO: 1, SURVIVOR: 0.1 };

/** The three services the treasury reads: Ethplorer (Ethereum), the Starknet RPC (balances, 1,000 of each token) and AVNU (prices). */
const services = (omitPriceOf: string[] = [], balanceAnswer: Response | null = null) =>
  vi.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes("ethplorer"))
      return Response.json({
        ETH: { rawBalance: "0", price: { rate: "2000" } },
        tokens: [
          {
            tokenInfo: { symbol: "LORDS", decimals: "18", price: { rate: "0.5" } },
            rawBalance: "5000000000000000000000",
          },
        ],
      });
    if (address.includes("identity-rpc"))
      return balanceAnswer?.clone() ?? Response.json({ result: [`0x${(1_000n * 10n ** 18n).toString(16)}`, "0x0"] });
    return Response.json(
      Object.entries(TOKENS)
        .filter(([symbol]) => !omitPriceOf.includes(symbol))
        .map(([symbol, address]) => ({
          address,
          starknetMarket: { usd: PRICES[symbol as keyof typeof PRICES] },
        })),
    );
  });

it("totals both chains at AVNU's prices when every balance and price is known", async () => {
  vi.stubGlobal("fetch", services());
  const totals = await getTreasuryBalance();
  expect(totals.LORDS).toEqual({ amount: 4 * 5_000 + 1_000, usdValue: 4 * 2_500 + 500 });
  expect(totals.ETH).toEqual({ amount: 1_000, usdValue: 2_000_000 });
  expect(totals.SURVIVOR).toEqual({ amount: 1_000, usdValue: 100 });
});

it("rejects instead of returning a total when one token has no price, and the section then shows its estimate", async () => {
  vi.stubGlobal("fetch", services(["SURVIVOR"]));
  await expect(getTreasuryBalance()).rejects.toThrow("no price");
  expect(treasurySupply(undefined)).toEqual({ treasury: "~40%", circulating: "~60%", treasurySub: "Estimated" });
});

it.each([
  ["a JSON-RPC error", Response.json({ error: { code: 20, message: "Contract not found" } })],
  ["a missing result", Response.json({})],
  ["a one-word result", Response.json({ result: ["0x1"] })],
  ["an empty result", Response.json({ result: [] })],
  ["an unsuccessful status", new Response("down", { status: 503 })],
  ["two empty words", Response.json({ result: ["", ""] })],
  ["two booleans", Response.json({ result: [false, false] })],
  ["an empty high word", Response.json({ result: ["0x1", ""] })],
  ["a negative word", Response.json({ result: ["-0x1", "0x0"] })],
  ["a word with no hex digits", Response.json({ result: ["0x", "0x0"] })],
  ["a decimal word", Response.json({ result: ["10", "0x0"] })],
  ["a word above u128", Response.json({ result: [`0x${(1n << 128n).toString(16)}`, "0x0"] })],
])(
  "rejects instead of counting %s as a zero balance, and the section then shows its estimate",
  async (_case, answer) => {
    vi.stubGlobal("fetch", services([], answer));
    await expect(getTreasuryBalance()).rejects.toThrow("Starknet balance read");
    expect(treasurySupply(undefined).treasurySub).toBe("Estimated");
  },
);

it("keeps a real two-word zero balance as a zero", async () => {
  vi.stubGlobal("fetch", services([], Response.json({ result: ["0x0", "0x0"] })));
  const totals = await getTreasuryBalance();
  expect(totals.SURVIVOR).toEqual({ amount: 0, usdValue: 0 });
  expect(totals.LORDS).toEqual({ amount: 4 * 5_000, usdValue: 4 * 2_500 });
});

it("shows the treasury's share of the supply only from a complete total", () => {
  expect(treasurySupply({ LORDS: { amount: 30_000_000 } })).toEqual({
    treasury: "10.0%",
    circulating: "90.0%",
    treasurySub: "Onchain",
  });
  expect(treasurySupply({ LORDS: { amount: 0 } }).treasurySub).toBe("Estimated");
});
