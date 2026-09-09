// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state = vi.hoisted(() => ({ gameId: 28, confirmedBlock: 10, handshake: 0, fetch: vi.fn() }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => state.gameId } }));
vi.mock("@/runtime/world", () => ({ getActiveWorld: () => ({ worldId: "blitz" }) }));
vi.mock("@/runtime/world/world-directory", () => ({
  getWorldById: () => ({ id: "blitz", chain: "madara", heraldBaseUrl: "https://herald.example" }),
  getDefaultWorld: vi.fn(),
}));
vi.mock("@/services/leaderboard/player-activity-breakdown-service", () => ({
  fetchLeaderboardActivityBreakdowns: state.fetch,
}));
vi.mock("@/hooks/store/use-connection-store", () => ({
  useConnectionStore: (selector: (value: { lastGlobalHandshake: number; lastConfirmedBlock: number }) => unknown) =>
    selector({ lastGlobalHandshake: state.handshake, lastConfirmedBlock: state.confirmedBlock }),
}));
import { LeaderboardActivitySync } from "@/ui/layouts/leaderboard-activity-sync";
import { useLeaderboardActivity } from "./use-leaderboard-activity";
afterEach(() => {
  state.gameId = 28;
  state.confirmedBlock = 10;
  state.handshake = 0;
  state.fetch.mockReset();
});
it("opens Players from cache, refreshes after confirmed heads and reconnects, and isolates games", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const entries = [{ address: "0x1", totalPoints: 5, rank: 1 }];
  state.fetch.mockResolvedValue(entries);
  const root = createRoot(document.createElement("div"));
  let displayed: unknown;

  function Panel() {
    displayed = useLeaderboardActivity().data;
    return null;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() =>
      expect(client.getQueryData(["leaderboard-activity", "https://herald.example", "madara", "blitz", 28])).toEqual(
        entries,
      ),
    );
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(displayed).toEqual(entries);
    expect(state.fetch).toHaveBeenCalledOnce();
    state.confirmedBlock = 11;
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(state.fetch).toHaveBeenCalledTimes(2);
    state.handshake = 1;
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(state.fetch).toHaveBeenCalledTimes(3);
    let finishRefresh!: (result: typeof entries) => void;
    state.fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        }),
    );
    state.confirmedBlock = 12;
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(state.fetch).toHaveBeenCalledTimes(4);
    state.confirmedBlock = 13;
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <LeaderboardActivitySync />
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(state.fetch).toHaveBeenCalledTimes(4);
    await act(async () => finishRefresh(entries));
    state.gameId = 29;
    state.fetch.mockImplementation(() => new Promise(() => {}));
    await act(async () =>
      root.render(
        <QueryClientProvider client={client}>
          <Panel />
        </QueryClientProvider>,
      ),
    );
    expect(displayed).toBeUndefined();
  } finally {
    await act(async () => root.unmount());
    client.clear();
  }
});
