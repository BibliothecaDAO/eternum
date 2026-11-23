import { AVNU_ROUTER, LORDS_ADDRESS, MAINNET_TOKENS, type MainnetToken } from "@realms-world/chain";
import { L2_LORDS, l2Provider } from "@/runtime/l2-rpc";

const MAINNET = "0x534e5f4d41494e";
const hex = (value: bigint) => `0x${value.toString(16)}`;

const HELD_BY_TOKEN: Record<MainnetToken, bigint> = {
  lords: 40n * 10n ** 18n,
  eth: 12n * 10n ** 15n,
  strk: 0n,
  usdc: 25_000_000n,
};
const HELD = new Map([
  ...Object.entries(HELD_BY_TOKEN).map(
    ([key, held]) => [BigInt(MAINNET_TOKENS[key as MainnetToken].address), held] as const,
  ),
  ...(L2_LORDS ? ([[BigInt(L2_LORDS), HELD_BY_TOKEN.lords]] as const) : []),
]);

const SOLD_FOR_THE_SEAL = new Map<bigint, bigint>([
  [BigInt(MAINNET_TOKENS.eth.address), 3_300_000_000_000_000n],
  [BigInt(MAINNET_TOKENS.usdc.address), 10_050_000n],
]);

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

export const isAvnuRead = (url: URL) => url.host === "starknet.api.avnu.fi";

export const answerAvnuRead = (url: URL, body: string | undefined): Response =>
  url.pathname.endsWith("/quotes") ? json([labQuote(url.searchParams)]) : json(labBuild(JSON.parse(body ?? "{}")));

export const answerTokenBalances = () => {
  const provider = l2Provider();
  const call = provider.callContract.bind(provider);
  Object.assign(provider, {
    callContract: async (request: Parameters<typeof call>[0], block?: Parameters<typeof call>[1]) => {
      const held = request.entrypoint === "balance_of" ? HELD.get(BigInt(request.contractAddress)) : undefined;
      return held === undefined ? call(request, block) : [hex(held), "0x0"];
    },
  });
  return () => Object.assign(provider, { callContract: call });
};

const labQuote = (asked: URLSearchParams) => {
  const sell = asked.get("sellTokenAddress")!;
  return {
    quoteId: `${sell}:${asked.get("buyAmount")}:${asked.get("takerAddress")}`,
    sellTokenAddress: sell,
    buyTokenAddress: LORDS_ADDRESS,
    sellAmount: hex(soldFor(sell, BigInt(asked.get("buyAmount")!))),
    buyAmount: asked.get("buyAmount"),
    chainId: MAINNET,
    routes: [{ name: "Ekubo", percent: 1 }],
  };
};

const labBuild = ({ quoteId }: { quoteId?: string }) => {
  const [sell, buyAmount, taker] = (quoteId ?? "").split(":") as [string, string, string];
  const bought = BigInt(buyAmount);
  const most = (soldFor(sell, bought) * 101n) / 100n;
  const u256 = (value: bigint) => [hex(value & ((1n << 128n) - 1n)), hex(value >> 128n)];
  return {
    chainId: MAINNET,
    calls: [
      { contractAddress: sell, entrypoint: "approve", calldata: [AVNU_ROUTER, ...u256(most)] },
      {
        contractAddress: AVNU_ROUTER,
        entrypoint: "swap_exact_token_to",
        calldata: [sell, ...u256(soldFor(sell, bought)), ...u256(most), LORDS_ADDRESS, ...u256(bought), taker, "0x0"],
      },
      { contractAddress: sell, entrypoint: "approve", calldata: [AVNU_ROUTER, "0x0", "0x0"] },
    ],
  };
};

const soldFor = (sell: string, lordsWei: bigint) =>
  ((SOLD_FOR_THE_SEAL.get(BigInt(sell)) ?? 1n) * lordsWei) / (2_750n * 10n ** 18n);
