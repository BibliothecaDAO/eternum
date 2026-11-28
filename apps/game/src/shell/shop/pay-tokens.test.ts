import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

const purchase = vi.hoisted(() => vi.fn());
const fee = vi.hoisted(() => vi.fn());
vi.mock("@realms-world/chain", async (original) => ({
  ...(await original<typeof import("@realms-world/chain")>()),
  avnuLordsPurchase: purchase,
}));
vi.mock("@/ui/modules/identity/wallet-send", () => ({ defaultWalletFeeOf: fee }));

import { MAINNET_TOKENS, splitLordsPayment, type MainnetToken } from "@realms-world/chain";
import { iconUrl } from "@/ui/design-system/icon-meaning";

import { PAY_TOKEN_ICONS, paymentIn, payTokensFor, quoteSplitOf, type FragmentQuote } from "./pay-tokens";

const WEI = 10n ** 18n;
const PAYER = "0x4a1";
const VELORDS = "0x91b";
const SPLIT = splitLordsPayment(2_750n * WEI);
const quote = (token: string = MAINNET_TOKENS.lords.address) => ({
  id: "quote-1",
  lordsWei: String(2_750n * WEI),
  token,
  treasury: "0x7a",
  treasuryWei: String(SPLIT.treasuryWei),
  veLords: VELORDS,
  veLordsWei: String(SPLIT.veLordsWei),
  expiresAt: 0,
});
const swap = [
  { contractAddress: MAINNET_TOKENS.eth.address, entrypoint: "approve", calldata: ["0x1", "0x2", "0x0"] },
  { contractAddress: "0xa7", entrypoint: "swap_exact_token_to", calldata: ["0x3"] },
];
const payTreasury = {
  contractAddress: MAINNET_TOKENS.lords.address,
  entrypoint: "transfer",
  calldata: ["0x7a", String(SPLIT.treasuryWei), "0"],
};
const payVeLords = {
  contractAddress: MAINNET_TOKENS.lords.address,
  entrypoint: "transfer",
  calldata: [VELORDS, String(SPLIT.veLordsWei), "0"],
};

afterEach(() => vi.clearAllMocks());

it("draws every token the shop takes with an icon the app ships", () => {
  for (const key of Object.keys(MAINNET_TOKENS) as MainnetToken[])
    expect(existsSync(resolve("public", iconUrl(PAY_TOKEN_ICONS[key]).slice(1))), key).toBe(true);
});

it("offers every token on production's LORDS, and only the quote's own token elsewhere", () => {
  expect(payTokensFor(quote()).map(({ symbol }) => symbol)).toEqual(["LORDS", "ETH", "STRK", "USDC"]);
  expect(payTokensFor(quote("0x10e5"))).toEqual([{ ...MAINNET_TOKENS.lords, key: "lords", address: "0x10e5" }]);
});

it("pays in LORDS as the atomic 95/5 treasury and veLords transfers, asking AVNU nothing", async () => {
  const [lords] = payTokensFor(quote());
  await expect(paymentIn(lords!, quote(), PAYER, true)).resolves.toMatchObject({
    cost: 2_750n * WEI,
    calls: [payTreasury, payVeLords],
    lordsBought: 0n,
  });
  expect(purchase).not.toHaveBeenCalled();
});

it("pays in another token with AVNU's swap for the quoted LORDS, then the wallet's split transfers", async () => {
  purchase.mockResolvedValue({ sellAmount: 4n * 10n ** 15n, maxSellAmount: 5n * 10n ** 15n, calls: swap });
  const eth = payTokensFor(quote())[1]!;
  await expect(paymentIn(eth, quote(), PAYER, false)).resolves.toMatchObject({
    cost: 4n * 10n ** 15n,
    most: 5n * 10n ** 15n,
    calls: [...swap, payTreasury, payVeLords],
    lordsBought: 2_750n * WEI,
  });
  expect(purchase).toHaveBeenCalledOnce();
  expect(purchase).toHaveBeenCalledWith({
    sellToken: MAINNET_TOKENS.eth.address,
    lordsWei: 2_750n * WEI,
    taker: PAYER,
    slippage: 0.01,
  });
  expect(fee).not.toHaveBeenCalled();
});

it("buys a passkey wallet's network fee in the same swap, with room for a fee priced again before signing", async () => {
  purchase.mockResolvedValue({ sellAmount: 4n * 10n ** 15n, maxSellAmount: 5n * 10n ** 15n, calls: swap });
  fee.mockResolvedValue({ estimated: 2n * WEI, max: 3n * WEI });
  const eth = payTokensFor(quote())[1]!;
  const payment = await paymentIn(eth, quote(), PAYER, true);
  expect(purchase.mock.calls.map(([asked]) => asked.lordsWei)).toEqual([2_750n * WEI, 2_756n * WEI]);
  expect(payment.lordsBought).toBe(2_756n * WEI);
  expect(payment.calls.slice(-2)).toEqual([payTreasury, payVeLords]);
});

it("emits atomic 95% treasury + 5% veLords transfer calls when the quote carries a veLords split", async () => {
  const splitQuote: FragmentQuote = {
    ...quote(),
    lordsWei: String(2_000n * WEI),
    treasuryWei: String(1_900n * WEI),
    veLords: "0x5e10",
    veLordsWei: String(100n * WEI),
  };
  const [lords] = payTokensFor(splitQuote);
  const expectedCalls = [
    {
      contractAddress: MAINNET_TOKENS.lords.address,
      entrypoint: "transfer",
      calldata: ["0x7a", String(1_900n * WEI), "0"],
    },
    {
      contractAddress: MAINNET_TOKENS.lords.address,
      entrypoint: "transfer",
      calldata: ["0x5e10", String(100n * WEI), "0"],
    },
  ];
  await expect(paymentIn(lords!, splitQuote, PAYER, true)).resolves.toMatchObject({
    cost: 2_000n * WEI,
    calls: expectedCalls,
    lordsBought: 0n,
  });

  purchase.mockResolvedValue({ sellAmount: 4n * 10n ** 15n, maxSellAmount: 5n * 10n ** 15n, calls: swap });
  fee.mockResolvedValue({ estimated: 1n * WEI, max: 2n * WEI });
  const eth = payTokensFor(splitQuote)[1]!;
  const swapped = await paymentIn(eth, splitQuote, PAYER, true);
  expect(fee).toHaveBeenCalledWith([...swap, ...expectedCalls]);
  expect(swapped.calls).toEqual([...swap, ...expectedCalls]);
  expect(swapped.lordsBought).toBe(2_004n * WEI);
});

it("refuses a quote split whose treasuryWei and veLordsWei do not sum to lordsWei", () => {
  const broken: FragmentQuote = {
    ...quote(),
    lordsWei: String(2_000n * WEI),
    treasuryWei: String(1_800n * WEI),
    veLords: "0x5e10",
    veLordsWei: String(100n * WEI),
  };
  expect(() => quoteSplitOf(broken)).toThrow();
});
