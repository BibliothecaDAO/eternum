import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const history = vi.hoisted(() =>
  vi.fn(async () => ({ items: [], complete_through_block: 0, limit: 1, offset: 0, total: 0 })),
);

vi.mock("@/hooks/context/game-context", () => ({ useGame: () => ({ setup: { store: {} } }) }));
vi.mock("@/hooks/use-player-profile", () => ({ getPlayerName: () => null }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum/game-client", () => ({
  fetchHeraldGameHistory: history,
  requireShard: () => ({ url: "http://herald.test", chainId: "0x1", worldAddress: "0xabc" }),
}));
vi.mock("@bibliothecadao/eternum", () => ({
  buildStoryEventPresentation: () => ({}),
  configManager: { getActiveGameId: () => 1 },
  hasStoryPresentation: () => true,
}));

import { useConnectionStore } from "./use-connection-store";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents, useSeasonWinner } from "./use-story-events-store";

const scope = { chainId: "0x1", worldAddress: "0xabc", gameId: 1 };

const story = (index: number, variant: Record<string, unknown>, owner = "0x0") =>
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
        timestamp: `0x${(100 + index).toString(16)}`,
      },
    },
    scope,
    { block: index, preconfirmed: false },
  );

const Winner = () => <p>{useSeasonWinner()?.toString(16) ?? "none"}</p>;

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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

afterEach(() => act(() => root.unmount()));

describe("a story read", () => {
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
});
