import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ now: 60, end: 100, revision: 0, structures: [{ entityId: 1 }] }));
const history = vi.hoisted(() =>
  vi.fn(async () => ({ items: [], complete_through_block: 30, limit: 100, offset: 0, total: 0 })),
);
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: { inGame: () => [{ structure_id: 1n, troops: { battle_cooldown_end: world.end } }] } },
  }),
}));
vi.mock("@/hooks/use-player-profile", () => ({ getPlayerName: () => null }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum/game-client", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum/game-client")>()),
  fetchHeraldGameHistory: history,
  requireShard: () => ({ url: "http://herald.test", chainId: "0x1", worldAddress: "0xabc" }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  buildStoryEventPresentation: () => ({}),
  hasStoryPresentation: () => true,
  configManager: { getActiveGameId: () => 1 },
}));
vi.mock("@/hooks/helpers/use-block-timestamp", () => ({ useNowMs: () => world.now * 1000 }));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => world.revision }));
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: "0xabc" } }),
}));
vi.mock("@/hooks/store/use-ui-store", () => ({
  useUIStore: (select: (state: unknown) => unknown) => select({ arrivedArrivalStructureIds: [] }),
}));
vi.mock("@/hooks/use-fact-view", () => ({ useFactView: () => world.structures }));
vi.mock("@/sync/fact-views", () => ({ playerStructuresView: {} }));
vi.mock("@/three/utils/utils", () => ({ isAddressEqualToAccount: (address: string) => BigInt(address) === 0xabcn }));

import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useStructureAttention } from "./use-structure-attention";
const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 1 };
const liveHit = (block: number) =>
  acceptGameSyncStoryEvent(
    {
      model: "BattleEvent",
      key: `hit${block}`,
      value: {
        game_id: 1,
        attacker_id: 900 + block,
        defender_id: 1,
        attacker: { player: "0xdef" },
        defender: { player: "0xabc" },
        timestamp: block,
        event_position: {
          block_number: block,
          transaction_hash: `0x${block.toString(16)}`,
          transaction_index: 0,
          event_index: 0,
        },
      },
    },
    scope,
    { block, preconfirmed: false, confirmedAfterAttach: true },
  );
const Probe = () => <output>{useStructureAttention().attackedCount}</output>;
let root: Root | undefined;
const releases: Array<() => void> = [];
afterEach(async () => {
  await act(async () => {
    releases.forEach((fn) => fn());
    root?.unmount();
  });
  resetGameSyncStoryEvents();
});

it("does not reuse pre-disconnect live hits for an own-sortie cooldown in the replacement snapshot", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  resetGameSyncStoryEvents();
  const host = document.createElement("div");
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const show = () =>
    root!.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  await act(async () => {
    show();
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  await act(async () => {
    liveHit(10);
    liveHit(20);
    liveHit(30);
  });
  expect(host.textContent).toBe("1"); // positive live hostile control before the disconnect

  // While disconnected, the old ranged cooldown expires at 100 and an own sortie at 110 sets end=170.
  // Reconnect supplies current facts by snapshot, while its history refetch has not answered yet.
  history.mockImplementation(
    () =>
      new Promise((resolve) =>
        releases.push(() => resolve({ items: [], complete_through_block: 110, limit: 100, offset: 0, total: 0 })),
      ),
  );
  await act(async () => {
    useConnectionStore.getState().setGlobalStatus("reconnecting");
    world.now = 120;
    world.end = 170;
    world.revision++;
    useConnectionStore.getState().recordGlobalHandshake();
    useConnectionStore.getState().setGlobalStatus("connected");
    show();
  });
  expect(history.mock.calls.length).toBeGreaterThanOrEqual(6);
  expect(host.textContent).toBe("0");

  // A hostile hit on the new stream restores the alert.
  await act(async () => {
    liveHit(115);
  });
  expect(host.textContent).toBe("1");
});
