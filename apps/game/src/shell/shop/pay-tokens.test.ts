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

import { MAINNET_TOKENS, type MainnetToken } from "@realms-world/chain";
import { iconUrl } from "@/ui/design-system/icon-meaning";

import { PAY_TOKEN_ICONS, paymentIn, payTokensFor } from "./pay-tokens";

const WEI = 10n ** 18n;
const PAYER = "0x4a1";
const quote = (token: string = MAINNET_TOKENS.lords.address) => ({
  id: "quote-1",
  lordsWei: String(2_750n * WEI),
  token,
  treasury: "0x7a",
  expiresAt: 0,
});
const swap = [
  { contractAddress: MAINNET_TOKENS.eth.address, entrypoint: "approve", calldata: ["0x1", "0x2", "0x0"] },
  { contractAddress: "0xa7", entrypoint: "swap_exact_token_to", calldata: ["0x3"] },
];
const pay = {
  contractAddress: MAINNET_TOKENS.lords.address,
  entrypoint: "transfer",
  calldata: ["0x7a", String(2_750n * WEI), "0"],
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

it("pays in LORDS as the one transfer, asking AVNU nothing", async () => {
  const [lords] = payTokensFor(quote());
  await expect(paymentIn(lords!, quote(), PAYER, true)).resolves.toMatchObject({
    cost: 2_750n * WEI,
    calls: [pay],
    lordsBought: 0n,
  });
  expect(purchase).not.toHaveBeenCalled();
});

it("pays in another token with AVNU's swap for the quoted LORDS, then the wallet's own transfer", async () => {
  purchase.mockResolvedValue({ sellAmount: 4n * 10n ** 15n, maxSellAmount: 5n * 10n ** 15n, calls: swap });
  const eth = payTokensFor(quote())[1]!;
  await expect(paymentIn(eth, quote(), PAYER, false)).resolves.toMatchObject({
    cost: 4n * 10n ** 15n,
    most: 5n * 10n ** 15n,
    calls: [...swap, pay],
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
  expect(payment.calls.at(-1)).toEqual(pay);
});
