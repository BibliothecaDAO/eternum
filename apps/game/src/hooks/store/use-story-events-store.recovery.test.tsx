import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HeraldHistoryEvent } from "@bibliothecadao/eternum/game-sync";

const history = vi.hoisted(() =>
  vi.fn(async () => ({ items: [] as HeraldHistoryEvent[], complete_through_block: 0, limit: 1, offset: 0, total: 0 })),
);

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/use-player-profile", () => ({ getPlayerName: () => null }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum/game-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@bibliothecadao/eternum/game-client")>()),
  fetchHeraldGameHistory: history,
  requireShard: () => ({ url: "http://herald.test", chainId: "0x1", worldAddress: "0xabc" }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  buildStoryEventPresentation: () => ({}),
  configManager: { getActiveGameId: () => 1 },
  hasStoryPresentation: () => true,
}));

import { useConnectionStore } from "./use-connection-store";
import {
  acceptGameSyncStoryEvent,
  resetGameSyncStoryEvents,
  useSeasonWinner,
  useStoryEvents,
  useStoryReads,
} from "./use-story-events-store";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 1 };

/** A streamed story at its place on the chain: block (null while pre-confirmed), transaction and event index. */
const storyAt = (
  index: number,
  variant: Record<string, unknown>,
  place: { block: number | null; transaction: number; event?: number; timestamp?: number },
  owner = "0x0",
) =>
  acceptGameSyncStoryEvent(
    {
      model: "StoryEvent",
      key: `0xstory${index}`,
      value: {
        game_id: "0x1",
        order: `0x${index.toString(16)}`,
        index: "0x0",
        owner,
        entity_id: "0x0",
        tx_hash: `0x${(index + 1).toString(16)}`,
        story: variant,
        timestamp: `0x${(place.timestamp ?? 100 + index).toString(16)}`,
        event_position: {
          block_number: place.block,
          transaction_hash: `0x${(index + 1).toString(16)}`,
          transaction_index: place.transaction,
          event_index: place.event ?? 0,
        },
      },
    },
    scope,
    { block: place.block, preconfirmed: place.block === null },
  );
const story = (index: number, variant: Record<string, unknown>, owner = "0x0") =>
  storyAt(index, variant, { block: index, transaction: 0 }, owner);

const Winner = () => <p>{useSeasonWinner()?.toString(16) ?? "none"}</p>;
const Log = () => (
  <ol>
    {useStoryEvents(10).data.map((event) => (
      <li key={event.id}>{event.story}</li>
    ))}
  </ol>
);

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  history.mockClear();
  resetGameSyncStoryEvents();
  host = document.createElement("div");
  root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Winner />
      </QueryClientProvider>,
    ),
  );
});

afterEach(() => {
  history.mockReset();
  history.mockResolvedValue({ items: [], complete_through_block: 0, limit: 1, offset: 0, total: 0 });
  act(() => root.unmount());
  notifyManager.setNotifyFunction((notify) => notify());
});

it("recovers the exact relic activation from history on reload without an active effect or a streamed event", async () => {
  const payload = {
    relic_id: "0x29",
    recipient: "Explorer",
    rate_bps: "0x4e2",
    duration_seconds: "0x708",
    radius: "0x0",
  };
  history.mockResolvedValue({
    items: [
      {
        model: "StoryEvent",
        game_id: "1",
        block_number: 10,
        transaction_hash: "0xfeed",
        transaction_index: 0,
        event_index: 2,
        value: {
          game_id: "0x1",
          owner: "0xa",
          entity_id: "0x9",
          timestamp: "0x64",
          story: { RelicActivated: payload },
        },
      },
    ],
    complete_through_block: 10,
    limit: 1,
    offset: 0,
    total: 1,
  });
  const RelicLog = () => (
    <ol>
      {useStoryEvents(10, "RelicActivated", "0xa").data.map((event) => (
        <li key={event.id}>
          {JSON.stringify({ owner: event.owner, target: event.entity_id, effect: event.storyPayload })}
        </li>
      ))}
    </ol>
  );
  for (let reload = 0; reload < 2; reload++) {
    await act(async () => resetGameSyncStoryEvents());
    const log = document.createElement("div");
    const logRoot = createRoot(log);
    await act(async () =>
      logRoot.render(
        <QueryClientProvider client={new QueryClient()}>
          <RelicLog />
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() => expect(log.querySelectorAll("li")).toHaveLength(1));
    expect(JSON.parse(log.querySelector("li")!.textContent!)).toEqual({ owner: "0xa", target: 9, effect: payload });
    await act(async () => logRoot.unmount());
  }
});

/** A streamed battle: `striker`'s army against `holder`'s structure 7. */
const battleStreamed = (index: number, striker: string, holder: string) =>
  acceptGameSyncStoryEvent(
    {
      model: "BattleEvent",
      key: `0xbattle${index}`,
      value: {
        game_id: "0x1",
        attacker_id: "0x384",
        defender_id: "0x7",
        attacker: { player: striker },
        defender: { player: holder },
        timestamp: `0x${(100 + index).toString(16)}`,
        event_position: {
          block_number: index,
          transaction_hash: `0xb${index.toString(16)}`,
          transaction_index: 0,
          event_index: 0,
        },
      },
    },
    scope,
    { block: index, preconfirmed: false },
  );

const PlayerBattles = () => (
  <ol>
    {useStoryEvents(10, "BattleEvent", "0x0a").data.map((event) => (
      <li key={event.id}>{String((event.storyPayload.attacker as { player: string }).player)}</li>
    ))}
  </ol>
);

/** A streamed capture of structure `structure`, block `index`. */
const captureStreamed = (index: number, structure: number) =>
  acceptGameSyncStoryEvent(
    {
      model: "StoryEvent",
      key: `0xcapture${index}`,
      value: {
        game_id: "0x1",
        order: `0x${index.toString(16)}`,
        index: "0x0",
        owner: "0x0e",
        entity_id: `0x${structure.toString(16)}`,
        tx_hash: `0xc${index.toString(16)}`,
        story: { StructureCapturedStory: { previous_owner: "0x0f", new_owner: "0x0e" } },
        timestamp: `0x${(100 + index).toString(16)}`,
        event_position: {
          block_number: index,
          transaction_hash: `0xc${index.toString(16)}`,
          transaction_index: 0,
          event_index: 0,
        },
      },
    },
    scope,
    { block: index, preconfirmed: false },
  );

const PlayerFightsAndStructureCaptures = () => (
  <ol>
    {useStoryReads([
      { limit: 2, story: "BattleEvent", owner: "0x0a" },
      { limit: 2, story: "StructureCapturedStory", entityId: 7 },
    ]).data.map((event) => (
      <li key={event.id}>{`${event.story}@${event.position.block}`}</li>
    ))}
  </ol>
);

describe("several story reads", () => {
  it("keep each its own newest, so what one leaves out never takes another's room, all newest on the chain first", async () => {
    const log = document.createElement("div");
    const logRoot = createRoot(log);
    await act(async () =>
      logRoot.render(
        <QueryClientProvider client={new QueryClient()}>
          <PlayerFightsAndStructureCaptures />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      battleStreamed(1, "0x0a", "0x0b");
      captureStreamed(2, 7);
      battleStreamed(3, "0x0c", "0x0a");
      for (let index = 10; index < 40; index++) battleStreamed(index, "0x0c", "0x0d");
      for (let index = 40; index < 70; index++) captureStreamed(index, 8);
    });
    expect([...log.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "BattleEvent@3",
      "StructureCapturedStory@2",
      "BattleEvent@1",
    ]);
    await act(async () => logRoot.unmount());
  });
});

describe("a story read", () => {
  it("keeps, for a player's read, each streamed story naming the player, as their attacker or their defender", async () => {
    const log = document.createElement("div");
    const logRoot = createRoot(log);
    await act(async () =>
      logRoot.render(
        <QueryClientProvider client={new QueryClient()}>
          <PlayerBattles />
        </QueryClientProvider>,
      ),
    );
    await act(async () => {
      battleStreamed(1, "0x0a", "0x0b");
      battleStreamed(2, "0x0c", "0x0a");
      battleStreamed(3, "0x0c", "0x0d");
    });
    expect([...log.querySelectorAll("li")].map((item) => item.textContent)).toEqual(["0x0c", "0x0a"]);
    await act(async () => logRoot.unmount());
  });

  it("reads Herald's history once per handshake, never once per confirmed block", async () => {
    expect(history).toHaveBeenCalledTimes(1);
    for (let block = 1; block <= 30; block++) {
      await act(async () => useConnectionStore.getState().recordConfirmedHead(block));
    }
    expect(history).toHaveBeenCalledTimes(1);
    await act(async () => useConnectionStore.getState().recordGlobalHandshake());
    expect(history).toHaveBeenCalledTimes(2);
  });

  it("keeps the season's ending the stream delivered after the stream's ring has moved past it", async () => {
    await act(async () => story(1, { SeasonEnded: {} }, "0x7"));
    expect(host.textContent).toBe("7");
    await act(async () => {
      for (let index = 2; index < 600; index++) story(index, { ExplorerMove: {} });
    });
    expect(host.textContent).toBe("7");
  });

  it("lists stories newest on the chain first: pre-confirmed above blocks, then block, transaction and event", async () => {
    const log = document.createElement("div");
    const logRoot = createRoot(log);
    await act(async () =>
      logRoot.render(
        <QueryClientProvider client={new QueryClient()}>
          <Log />
        </QueryClientProvider>,
      ),
    );
    // One block's stories share a timestamp; only their place on the chain orders them.
    await act(async () => {
      storyAt(1, { ExplorerMove: {} }, { block: 7, transaction: 2, timestamp: 500 });
      storyAt(2, { BuildingPlaced: {} }, { block: 7, transaction: 0, timestamp: 500 });
      storyAt(3, { RealmCreated: {} }, { block: 7, transaction: 2, event: 1, timestamp: 500 });
      storyAt(4, { ExplorerExplored: {} }, { block: 6, transaction: 9, timestamp: 600 });
      storyAt(5, { ArmyDeployed: {} }, { block: null, transaction: 0, timestamp: 400 });
    });
    expect([...log.querySelectorAll("li")].map((item) => item.textContent)).toEqual([
      "ArmyDeployed",
      "RealmCreated",
      "ExplorerMove",
      "BuildingPlaced",
      "ExplorerExplored",
    ]);
    act(() => logRoot.unmount());
  });
});
