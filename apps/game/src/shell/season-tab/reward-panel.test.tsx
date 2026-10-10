import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Call } from "starknet";
import { afterEach, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => ({ calls: [] as Call[][] }));
vi.mock("@/ui/modules/identity/wallet-actions", () => ({
  WalletSign: ({ calls, onLanded }: { calls: Call[]; onLanded: () => void }) => (
    <button
      type="button"
      onClick={() => {
        signed.calls.push(calls);
        onLanded();
      }}
    >
      Sign
    </button>
  ),
}));
vi.mock("@/runtime/l2-rpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/runtime/l2-rpc")>()),
  l2Provider: () => ({ callContract: () => new Promise(() => {}) }),
}));

import type { PaidGameLedger } from "@realms-world/identity";
import { payingWalletKey } from "../value/paying-wallet";
import { type Reward, rewardKey } from "./reward";
import { RewardPanel } from "./reward-panel";

const WEI = 10n ** 18n;
const LEDGER: PaidGameLedger = {
  address: "0x1ed9e7",
  chainId: "0x534e5f4d41494e",
  shard: "0x52",
  gameId: 7,
};
const CHEST = { seasonId: 3, band: 0, requested: false, finished: false, requester: "0x0", requestBlock: 0 };
const OPENED = { ...CHEST, requested: true, finished: true, requester: "0x4a1", requestBlock: 812300 };
const SEALED: Reward = {
  result: { rank: 3, chestId: 41n, mmrBefore: 1744, mmrAfter: 1780 },
  collection: "0xc4e57",
  chest: CHEST,
  held: true,
  content: null,
  seasonEnd: Math.floor(Date.now() / 1000) + 86_400,
  registration: { registered: true, sword: true, shield: false, swordCredit: false, shieldCredit: false, paid: 0n },
};
const unmounts: (() => Promise<void>)[] = [];

/** The game's registrations name 0x4a1 as the wallet that paid the player's seat, unless `payer` says otherwise. */
const mount = async (reward: Reward, payer: string | null = "0x4a1") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  client.setQueryData(payingWalletKey(LEDGER, "0xplayer"), payer);
  client.setQueryData(rewardKey(LEDGER, "0x4a1"), reward);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <RewardPanel ledger={LEDGER} account="0xplayer" />
      </QueryClientProvider>,
    ),
  );
  unmounts.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
};

const press = (container: HTMLElement, text: string) =>
  act(async () =>
    [...container.querySelectorAll("button")].find((button) => button.textContent?.includes(text))!.click(),
  );

afterEach(async () => {
  for (const unmount of unmounts.splice(0)) await unmount();
  signed.calls = [];
});

it("shows the sword's doubled gain and a sealed chest's band only, opened by the holder's one signature", async () => {
  const panel = await mount(SEALED);
  expect(panel.textContent).toContain("+36");
  expect(panel.textContent).toContain("×2");
  expect(panel.textContent).toContain("Top 10%");
  expect(panel.textContent).toContain("LORDS until");
  expect(panel.querySelector('img[src*="blitz-chests"]')?.getAttribute("src")).toBe(
    "/images/blitz-chests/band-0-sealed.webp",
  );
  await press(panel, "Open");
  await press(panel, "Sign");
  expect(signed.calls).toEqual([
    [
      { contractAddress: "0xc4e57", entrypoint: "approve", calldata: ["0x1ed9e7", "41", "0"] },
      { contractAddress: "0x1ed9e7", entrypoint: "open_request", calldata: ["41", "0"] },
    ],
  ]);
});

it("keeps a chest to trade, waits on the draw, and shows what an opened one delivered", async () => {
  const kept = await mount(SEALED);
  await press(kept, "Keep");
  expect(kept.textContent).toContain("Tradeable");

  expect((await mount({ ...SEALED, seasonEnd: 1 })).textContent).toContain("No LORDS now");
  expect((await mount({ ...SEALED, chest: { ...OPENED, finished: false }, held: false })).textContent).toContain(
    "Opening",
  );
  const item = await mount({
    ...SEALED,
    chest: OPENED,
    held: false,
    content: { kind: "cosmetic", attributes: "0x4040d01" },
  });
  expect(item.textContent).toContain("Overgrown Wreath");
  const lords = await mount({ ...SEALED, chest: OPENED, held: false, content: { kind: "lords", amount: 700n * WEI } });
  expect(lords.textContent).toContain("700");
  const pending = await mount({ ...SEALED, result: { ...SEALED.result, rank: 0, chestId: 0n }, chest: null });
  expect(pending.textContent).toContain("Arrives with the results");
});

it("draws nothing for an account that held no seat in the game", async () => {
  expect((await mount(SEALED, null)).textContent).toBe("");
});
