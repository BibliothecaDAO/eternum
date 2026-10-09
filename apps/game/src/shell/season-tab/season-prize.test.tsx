import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Call } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({ calls: [] as Call[][] }));
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ calls, onSent }: { calls: Call[]; onSent: (hash: string) => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        onSent("0xtx");
      }}
    >
      Sign
    </button>
  ),
}));
const session = vi.hoisted(() => ({
  user: { realmsId: "0x7", payoutWallet: { status: "ready", address: "0x4a1" } },
}));
vi.mock("@/hooks/context/identity-session", () => ({ useIdentitySession: () => ({ status: "signed-in", session }) }));
vi.mock("../herald", () => ({
  useRealmsPlayer: () => ({ data: "0xplayer" }),
  useDirectory: () => ({
    data: {
      games: [
        {
          chainId: "0x52",
          game_id: 7,
          mode: "blitz",
          clock: { start_main_at: 1 },
          ledger: { address: "0xl", chest: "0xc" },
        },
      ],
    },
  }),
  useRecentResults: () => ({ data: { games: [] } }),
}));

import { type SeasonPrize, seasonPrizeKey } from "./blitz-season";
import { SeasonPrizePanel } from "./season-prize";

const WEI = 10n ** 18n;
const NOW = Math.floor(Date.now() / 1000);
const unmounts: (() => Promise<void>)[] = [];

const mount = async (prize: SeasonPrize) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(seasonPrizeKey("0xl", "0x52:7", "0x4a1"), prize);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <SeasonPrizePanel />
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const prize = (season: Partial<SeasonPrize["season"]>, rest: Partial<SeasonPrize> = {}): SeasonPrize => ({
  ledger: "0xl",
  seasonId: 3,
  season: {
    participants: 25,
    winners: 3,
    posted: false,
    challenged: false,
    reviewUntil: 0,
    presetId: 4,
    start: NOW - 3600,
    end: NOW + 3600,
    pool: 7_000n * WEI,
    ...season,
  },
  curve: { paidFractionBps: 1000, decayBps: 5000 },
  share: null,
  claimed: false,
  strk: WEI,
  ...rest,
});

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
});

it("shows the pool and what the paid places would take if the season ended now", async () => {
  const panel = await mount(prize({}));
  expect(panel.textContent).toContain("7,000");
  expect(panel.textContent).toContain("3 places paid");
  expect(panel.textContent).toContain("4,000");
  expect(panel.textContent).toContain("1,000");
});

it("waits out the review hour, then claims a winner's share from the payout wallet", async () => {
  const posted = { posted: true, end: NOW - 7200 };
  expect((await mount(prize({ ...posted, reviewUntil: NOW + 1800 }, { share: 4_000n * WEI }))).textContent).toContain(
    "Claims open in",
  );
  const claim = await mount(prize({ ...posted, reviewUntil: NOW - 60 }, { share: 4_000n * WEI }));
  await act(async () =>
    [...claim.querySelectorAll("button")].find((button) => button.textContent === "Claim")!.click(),
  );
  await act(async () => [...claim.querySelectorAll("button")].find((button) => button.textContent === "Sign")!.click());
  expect(signed.calls).toEqual([[{ contractAddress: "0xl", entrypoint: "claim_season", calldata: ["3"] }]]);
  expect(
    (await mount(prize({ ...posted, reviewUntil: NOW - 60 }, { share: 4_000n * WEI, strk: 0n }))).textContent,
  ).toContain("No STRK for the fee");
  expect((await mount(prize({ ...posted, challenged: true }, { share: 4_000n * WEI }))).textContent).toContain(
    "being checked",
  );
  expect((await mount(prize({ ...posted, reviewUntil: NOW - 60 }))).textContent).toContain("Outside the paid places");
});
