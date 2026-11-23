import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";

import { treasuryBalanceQueryOptions } from "@/site/lib/query-options";

import { EconomicsSection } from "./EconomicsSection";

vi.mock("@/site/hooks/use-velords", () => ({
  useVelords: () => ({ currentAPY: undefined, averageWeeklyRewards: undefined, lordsLocked: undefined }),
}));
vi.mock("@/site/lib/getLordsPrice", () => ({ getLordsInfo: async () => ({}) }));
vi.mock("@/site/components/ui/LordsFlywheel", () => ({ LordsFlywheel: () => null }));
vi.mock("framer-motion", () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_, tag: string) =>
        ({ children }: { children?: unknown }) =>
          createElement(tag, null, children as never),
    },
  ),
}));

afterEach(() => vi.unstubAllGlobals());

const TOKENS = [
  "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
  "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
  "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  "0x75afe6402ad5a5c20dd25e10ec3b3986acaa647b77e4ae24b0cbc9a54a27a87",
  "0x42dd777885ad2c116be96d4d634abc90a26a790ffb5871e037dd5ae7d2ec86b",
];

const marketAndChain = (balance: Response) =>
  vi.fn(async (url: string | URL | Request) => {
    const address = String(url);
    if (address.includes("ethplorer"))
      return Response.json({ ETH: { rawBalance: "0", price: { rate: "2000" } }, tokens: [] });
    if (address.includes("identity-rpc")) return balance.clone();
    return Response.json(TOKENS.map((token) => ({ address: token, starknetMarket: { usd: 1 } })));
  });

const sectionAfterQuery = async (balance: Response) => {
  vi.stubGlobal("fetch", marketAndChain(balance));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await client.prefetchQuery(treasuryBalanceQueryOptions());
  return renderToString(createElement(QueryClientProvider, { client }, createElement(EconomicsSection)));
};

it("shows its estimate when the treasury query rejects on a malformed balance word", async () => {
  const html = await sectionAfterQuery(Response.json({ result: ["", ""] }));
  expect(html).toContain("~40%");
  expect(html).toContain("Estimated");
  expect(html).not.toContain("Onchain");
});

it("shows the onchain share when every balance word is valid", async () => {
  const html = await sectionAfterQuery(Response.json({ result: [`0x${(1_000n * 10n ** 18n).toString(16)}`, "0x0"] }));
  expect(html).toContain("Onchain");
  expect(html).not.toContain("Estimated");
});
