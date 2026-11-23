import type { FragmentPrice } from "@realms-world/identity";
import { avnuLordsPurchase, MAINNET_TOKENS, type MainnetToken } from "@realms-world/chain";
import type { Call } from "starknet";

import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { defaultWalletFeeOf } from "@/ui/modules/identity/wallet-send";

import { transferLordsCall } from "../value/ledger";

export const PAY_TOKEN_ICONS = {
  lords: "lords",
  eth: "brand-eth",
  strk: "strk",
  usdc: "brand-usdc",
} as const satisfies Record<MainnetToken, IconMeaning>;

const SLIPPAGE = 0.01;
const FEE_ROOM_PER_FEE_PRICED = 2n;

type Quote = NonNullable<FragmentPrice["quote"]>;

export interface PayToken {
  key: MainnetToken;
  address: string;
  symbol: string;
  decimals: number;
}

export interface TokenPayment {
  token: PayToken;
  cost: bigint;
  most: bigint;
  calls: Call[];
  lordsBought: bigint;
}

const MAINNET_PAY_TOKENS: readonly PayToken[] = (Object.keys(MAINNET_TOKENS) as MainnetToken[]).map((key) => ({
  key,
  ...MAINNET_TOKENS[key],
}));

export const payTokensForToken = (token: string): PayToken[] =>
  isMainnetLords(token) ? [...MAINNET_PAY_TOKENS] : [{ key: "lords", ...MAINNET_TOKENS.lords, address: token }];

export const payTokensFor = (quote: Quote): PayToken[] => payTokensForToken(quote.token);

export const paymentIn = async (
  token: PayToken,
  quote: Quote,
  payer: string,
  passkey: boolean,
): Promise<TokenPayment> => {
  const lordsWei = BigInt(quote.lordsWei);
  const pay = transferLordsCall(quote.token, quote.treasury, lordsWei);
  if (token.key === "lords") return { token, cost: lordsWei, most: lordsWei, calls: [pay], lordsBought: 0n };
  const purchase = (lords: bigint) =>
    avnuLordsPurchase({ sellToken: token.address, lordsWei: lords, taker: payer, slippage: SLIPPAGE });
  const exact = await purchase(lordsWei);
  const priced = passkey ? ((await defaultWalletFeeOf([...exact.calls, pay]))?.max ?? 0n) : 0n;
  const fee = priced * FEE_ROOM_PER_FEE_PRICED;
  const bought = fee === 0n ? exact : await purchase(lordsWei + fee);
  return {
    token,
    cost: bought.sellAmount,
    most: bought.maxSellAmount,
    calls: [...bought.calls, pay],
    lordsBought: lordsWei + fee,
  };
};

const isMainnetLords = (address: string) => BigInt(address) === BigInt(MAINNET_TOKENS.lords.address);
