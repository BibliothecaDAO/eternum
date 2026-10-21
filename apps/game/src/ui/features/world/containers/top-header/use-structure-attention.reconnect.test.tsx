import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const world = vi.hoisted(() => ({ now: 60, end: 100, revision: 0, structures: [{ entityId: 1 }] }));
const history = vi.hoisted(() =>
  vi.fn(async () => ({ items: [], complete_through_block: 30, limit: 100, offset: 0, total: 0 })),
);
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: { store: { inGame: () => [{ structure_id: 1n, troops: { battle_cooldown_end: world.end } }] } },
  }),
}));
// Names are not what these reads are about: no player has one, and none ever lands.
const NAMES = vi.hoisted(() => ({ text: () => "", reading: () => ({ state: "waiting" as const, text: "…" }) }));
vi.mock("@/hooks/use-player-profile", () => ({ usePlayerNames: () => NAMES }));
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
vi.mock("@/hooks/helpers/use-native-facts", async () =>
  (await import("@/hooks/helpers/native-facts-mock")).nativeFactsMock(() => world.revision),
);
vi.mock("@/hooks/store/use-account-store", () => ({
  useAccountStore: (select: (state: unknown) => unknown) => select({ account: { address: "0xabc" } }),
  useAccountAddress: () => 0xabcn,
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

/** A hostile battle on structure 1 as Herald's history returns it, and history complete through `through`. */
const historyWithHostileHit =
  (block: number, through: number) => async (_shard: unknown, _game: number, read: { model?: string }) => ({
    items:
      read.model === "BattleEvent"
        ? [
            {
              block_number: block,
              event_index: 0,
              game_id: "1",
              model: "BattleEvent",
              transaction_hash: `0x${block.toString(16)}`,
              transaction_index: 0,
              value: {
                game_id: 1,
                attacker_id: 900,
                defender_id: 1,
                attacker: { player: "0xdef" },
                defender: { player: "0xabc" },
                timestamp: block,
              },
            },
          ]
        : [],
    complete_through_block: through,
    limit: 100,
    offset: 0,
    total: read.model === "BattleEvent" ? 1 : 0,
  });

const attackedAfterReload = async (historyThrough: number) => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  resetGameSyncStoryEvents();
  Object.assign(world, { now: 60, end: 100 });
  // The reload's snapshot read the facts at block 35: the guards' cooldown, set by the hit at 30.
  useConnectionStore.getState().recordSnapshotBlock(35);
  history.mockImplementation(historyWithHostileHit(30, historyThrough) as never);
  const host = document.createElement("div");
  root = createRoot(host);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await act(async () => {
    root!.render(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return host.textContent;
};

it("recovers an attack after a reload once history holds every story through the snapshot's block", async () => {
  expect(await attackedAfterReload(40)).toBe("1");
});

it("stays silent after a reload while history is behind the snapshot's block", async () => {
  expect(await attackedAfterReload(34)).toBe("0");
});

const mountProbe = async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
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
  return { host, show };
};
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
/** Lets the reads and their renders settle: up to ten rounds, stopping once `done` holds. */
const settleUntil = async (done: () => boolean) => {
  for (let round = 0; round < 10 && !done(); round += 1) await settle();
};

it("re-reads history a replacement snapshot overtook in flight, and recovers the attack", async () => {
  resetGameSyncStoryEvents();
  Object.assign(world, { now: 60, end: 100 });
  useConnectionStore.getState().recordSnapshotBlock(30);
  // Every read observed history through 34; their answers are held.
  const held: Array<() => Promise<void>> = [];
  const heldRead = (_shard: unknown, _game: number, read: { model?: string }) =>
    new Promise((resolve) => {
      held.push(async () => resolve(await historyWithHostileHit(30, 34)(_shard, _game, read)));
    });
  history.mockImplementation(heldRead as never);
  const { host, show } = await mountProbe();
  expect(held).toHaveLength(3);
  // History commits through 40, then a replacement snapshot at 35 applies; its handshake meets the reads in flight.
  history.mockImplementation(historyWithHostileHit(30, 40) as never);
  const callsBefore = history.mock.calls.length;
  await act(async () => {
    useConnectionStore.getState().recordSnapshotBlock(35);
    useConnectionStore.getState().recordGlobalHandshake();
    show();
  });
  await act(async () => {
    await Promise.all(held.map((release) => release()));
  });
  await settleUntil(() => host.textContent === "1");
  // The overtaken answers (through 34) are behind the snapshot: each read went back for history through 40.
  expect(history.mock.calls.length - callsBefore).toBeGreaterThanOrEqual(3);
  expect(host.textContent).toBe("1");
});

it("re-reads history behind the snapshot on each confirmed head, and stops once it is covered", async () => {
  resetGameSyncStoryEvents();
  Object.assign(world, { now: 60, end: 100 });
  useConnectionStore.getState().recordSnapshotBlock(35);
  history.mockImplementation(historyWithHostileHit(30, 34) as never);
  const { host } = await mountProbe();
  await settle();
  expect(host.textContent).toBe("0"); // history is behind the snapshot: no alert from it yet
  history.mockImplementation(historyWithHostileHit(30, 36) as never);
  await act(async () => {
    useConnectionStore.getState().recordConfirmedHead(36);
  });
  await settleUntil(() => host.textContent === "1");
  expect(host.textContent).toBe("1");
  const covered = history.mock.calls.length;
  await act(async () => {
    useConnectionStore.getState().recordConfirmedHead(37);
  });
  await settle();
  expect(history.mock.calls.length).toBe(covered); // covered reads are not read again on a head
});

it("does not read an unchanged answer behind the snapshot again without a new head or snapshot", async () => {
  resetGameSyncStoryEvents();
  Object.assign(world, { now: 60, end: 100 });
  useConnectionStore.getState().recordSnapshotBlock(35);
  // History stays through 34; each answer is held until its wave is released.
  const held: Array<() => Promise<void>> = [];
  const heldRead = (_shard: unknown, _game: number, read: { model?: string }) =>
    new Promise((resolve) => {
      held.push(async () => resolve(await historyWithHostileHit(30, 34)(_shard, _game, read)));
    });
  history.mockClear();
  history.mockImplementation(heldRead as never);
  const { host, show } = await mountProbe();
  const counts = [history.mock.calls.length];
  for (let wave = 0; wave < 3; wave += 1) {
    // The HUD clock renders while the reads are held: neither a head nor a snapshot.
    await act(async () => {
      world.now += 1;
      show();
    });
    await act(async () => {
      await Promise.all(held.splice(0).map((release) => release()));
    });
    await settle();
    counts.push(history.mock.calls.length);
  }
  expect(counts).toEqual([3, 3, 3, 3]);
  expect(host.textContent).toBe("0");
});

const stuckAnswers = {
  "history stuck behind the snapshot": { read: historyWithHostileHit(30, 34), readsPerHead: 3 },
  "history whose coverage Herald does not know": {
    read: async () => ({ items: [], complete_through_block: null, limit: 100, offset: 0, total: 0 }),
    readsPerHead: 0,
  },
  "a failed history read": {
    read: async () => {
      throw new Error("history unavailable");
    },
    readsPerHead: 0,
  },
};

it.each(Object.entries(stuckAnswers))(
  "reads %s at most once per confirmed head, and stays without the alert",
  async (_answer, { read, readsPerHead }) => {
    resetGameSyncStoryEvents();
    Object.assign(world, { now: 60, end: 100 });
    useConnectionStore.getState().recordSnapshotBlock(35);
    history.mockClear();
    history.mockImplementation(read as never);
    const { host, show } = await mountProbe();
    await settle();
    expect(history).toHaveBeenCalledTimes(3);
    for (const head of [36, 37, 38, 39, 40]) {
      await act(async () => {
        useConnectionStore.getState().recordConfirmedHead(head);
      });
      await settle();
    }
    expect(history).toHaveBeenCalledTimes(3 + 5 * readsPerHead);
    // With no further head, renders of the clock read nothing.
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        world.now += 1;
        show();
      });
      await settle();
    }
    expect(history).toHaveBeenCalledTimes(3 + 5 * readsPerHead);
    expect(host.textContent).toBe("0");
  },
);

it("recovers attack attention after a transient history failure and a successful reconnect", async () => {
  resetGameSyncStoryEvents();
  Object.assign(world, { now: 60, end: 100 });
  useConnectionStore.getState().recordSnapshotBlock(35);
  history.mockReset();
  history.mockRejectedValue(new Error("temporary HTTP 503"));
  const { host, show } = await mountProbe();
  await settle();
  expect(host.textContent).toBe("0");
  expect(history).toHaveBeenCalledTimes(3);
  // HTTP recovers; the stream reconnects with a snapshot and head at 40, the guards' cooldown still set by the hit at 30.
  history.mockImplementation(historyWithHostileHit(30, 40) as never);
  await act(async () => {
    useConnectionStore.getState().setGlobalStatus("reconnecting");
    useConnectionStore.getState().recordGlobalHandshake();
    useConnectionStore.getState().recordSnapshotBlock(40);
    useConnectionStore.getState().recordConfirmedHead(40);
    useConnectionStore.getState().setGlobalStatus("connected");
    show();
  });
  await settleUntil(() => host.textContent === "1");
  expect(history).toHaveBeenCalledTimes(6);
  expect(host.textContent).toBe("1");
});

describe("an old history request still pending when the stream reconnects, failing after", () => {
  /** Three reads asked under snapshot 35 that hang through the outage; the reconnect at 40 meets them in flight. */
  const reconnectOverPendingReads = async () => {
    resetGameSyncStoryEvents();
    Object.assign(world, { now: 60, end: 100 });
    useConnectionStore.getState().recordSnapshotBlock(35);
    history.mockReset();
    const timeOut: Array<(error: Error) => void> = [];
    history.mockImplementation(() => new Promise((_, reject) => timeOut.push(reject)));
    const probe = await mountProbe();
    await settle();
    expect(history).toHaveBeenCalledTimes(3);
    return {
      ...probe,
      reconnect: (answer: () => void) =>
        act(async () => {
          answer();
          useConnectionStore.getState().setGlobalStatus("reconnecting");
          useConnectionStore.getState().recordGlobalHandshake();
          useConnectionStore.getState().recordSnapshotBlock(40);
          useConnectionStore.getState().recordConfirmedHead(40);
          useConnectionStore.getState().setGlobalStatus("connected");
          probe.show();
        }),
      failTheOldRequests: async () => {
        await act(async () => timeOut.forEach((reject) => reject(new Error("old request timed out"))));
        await settle();
        await settle();
      },
    };
  };

  it("asks each read once under the new handshake, and recovers the attack", async () => {
    const { host, reconnect, failTheOldRequests } = await reconnectOverPendingReads();
    await reconnect(() => history.mockImplementation(historyWithHostileHit(30, 40) as never));
    // The reconnect shares the reads in flight: no new request yet.
    expect(history).toHaveBeenCalledTimes(3);
    await failTheOldRequests();
    expect(history).toHaveBeenCalledTimes(6);
    expect(host.textContent).toBe("1");
  });

  it("asks once even when the new attempt fails too, then nothing on heads, renders or a remount", async () => {
    const { host, show, reconnect, failTheOldRequests } = await reconnectOverPendingReads();
    await reconnect(() => history.mockRejectedValue(new Error("history still unavailable")));
    await failTheOldRequests();
    expect(history).toHaveBeenCalledTimes(6);
    expect(host.textContent).toBe("0");
    for (let head = 41; head < 46; head += 1)
      await act(async () => {
        useConnectionStore.getState().recordConfirmedHead(head);
        show();
      });
    await settle();
    expect(history).toHaveBeenCalledTimes(6);
    await act(async () => root!.unmount());
    root = createRoot(host);
    await act(async () => {
      show();
      show();
    });
    await settle();
    expect(history).toHaveBeenCalledTimes(6);
  });
});
