// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ fetch: vi.fn(), head: 10, components: {}, gameId: 28, worldAddress: "0xabc" }));
const scope = { chain: "madara", worldAddress: "0xabc", gameId: 28 };
beforeEach(() => {
  state.gameId = 28;
  state.worldAddress = "0xabc";
});
vi.mock("@/runtime/world/herald-http", () => ({ fetchHeraldGameHistory: state.fetch }));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => ({ worldId: "blitz" }) }));
vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: () => ({
    id: "blitz",
    chain: "madara",
    heraldBaseUrl: "https://herald.example",
    worldAddress: state.worldAddress,
  }),
  getDefaultWorld: vi.fn(),
}));
vi.mock("@bibliothecadao/react", () => ({ useDojo: () => ({ setup: { components: state.components } }) }));
vi.mock("@bibliothecadao/eternum", () => ({
  configManager: { getActiveGameId: () => state.gameId },
  buildStoryEventPresentation: () => ({ title: "Battle", description: "Battle" }),
}));
vi.mock("./use-connection-store", () => ({
  useConnectionStore: (select: (value: { lastConfirmedBlock: number; lastGlobalHandshake: number }) => unknown) =>
    select({ lastConfirmedBlock: state.head, lastGlobalHandshake: 0 }),
}));
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents, useStoryEvents } from "./use-story-events-store";

const storyValue = (id: number, story: string) => ({
  game_id: "0x1c",
  id: String(id),
  tx_hash: `0x${id.toString(16)}`,
  timestamp: String(id),
  story: { [story]: {} },
});
const history = (id: number) => ({
  block_number: id,
  event_index: 0,
  game_id: "28",
  model: "StoryEvent",
  transaction_hash: `0x${id.toString(16)}`,
  transaction_index: 0,
  value: storyValue(id, "BattleStory"),
});

it("merges live/history copies, preserves same-transaction stories, and isolates game scopes", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(document.createElement("div"));
  let events: ReturnType<typeof useStoryEvents>["data"] = [];
  function Feed() {
    events = useStoryEvents().data;
    return null;
  }
  const render = () =>
    root.render(
      <QueryClientProvider client={client}>
        <Feed />
      </QueryClientProvider>,
    );
  resetGameSyncStoryEvents();
  state.fetch.mockResolvedValue({ items: [history(2), history(1)] });
  const streamed = {
    hashed_keys: "0xdifferent-from-receipt-index",
    models: { StoryEvent: { ...storyValue(2, "BattleStory"), id: "0x02", tx_hash: "0x0002" } },
  };
  try {
    await act(async () => {
      acceptGameSyncStoryEvent(streamed, scope);
      render();
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(events.map((event) => event.timestamp)).toEqual(["2", "1"]);
    });
    await act(async () => {
      acceptGameSyncStoryEvent(streamed, scope);
      acceptGameSyncStoryEvent(
        {
          hashed_keys: "0xanother-story",
          models: { StoryEvent: { ...storyValue(2, "BattleStory"), id: "3" } },
        },
        scope,
      );
    });
    expect(events).toHaveLength(3);
    expect(new Set(events.map((event) => event.event_id)).size).toBe(3);

    await act(async () => {
      acceptGameSyncStoryEvent(
        {
          hashed_keys: "0xother-game",
          models: { StoryEvent: { ...storyValue(4, "BattleStory"), game_id: "29" } },
        },
        { ...scope, gameId: 29 },
      );
    });
    expect(events).toHaveLength(3);
    state.fetch.mockResolvedValue({ items: [] });
    state.gameId = 29;
    await act(async () => render());
    expect(events.map((event) => event.timestamp)).toEqual(["4"]);
    state.worldAddress = "0xdef";
    await act(async () => render());
    expect(events).toHaveLength(0);
  } finally {
    await act(async () => root.unmount());
    client.clear();
    resetGameSyncStoryEvents();
    state.fetch.mockReset();
  }
});

it("keeps old battles after hundreds of routine stories and recovers confirmed battles after stream eviction", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient();
  const root = createRoot(document.createElement("div"));
  let events: ReturnType<typeof useStoryEvents>["data"] = [];
  function Feed() {
    events = useStoryEvents(350, "BattleStory").data;
    return null;
  }
  const render = () =>
    root.render(
      <QueryClientProvider client={client}>
        <Feed />
      </QueryClientProvider>,
    );
  state.fetch.mockResolvedValue({ items: [history(2), history(1)] });
  resetGameSyncStoryEvents();
  try {
    await act(async () => {
      render();
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(events).toHaveLength(2);
    });
    expect(state.fetch).toHaveBeenCalledWith(expect.anything(), 28, {
      limit: 350,
      model: "StoryEvent",
      story: "BattleStory",
    });
    await act(async () => {
      for (let id = 3; id < 603; id++)
        acceptGameSyncStoryEvent(
          {
            hashed_keys: String(id),
            models: { StoryEvent: storyValue(id, "ExplorerMoveStory") },
          },
          scope,
        );
    });
    expect(events.map((event) => event.timestamp)).toEqual(["2", "1"]);
    state.fetch.mockResolvedValue({ items: [history(603), history(2), history(1)] });
    state.head++;
    await act(async () => {
      render();
    });
    await vi.waitFor(async () => {
      await act(async () => {});
      expect(events.map((event) => event.timestamp)).toEqual(["603", "2", "1"]);
    });
  } finally {
    await act(async () => root.unmount());
    client.clear();
    resetGameSyncStoryEvents();
    state.fetch.mockReset();
    state.head = 10;
  }
});
