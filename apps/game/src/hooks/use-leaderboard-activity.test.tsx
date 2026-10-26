import { act } from "react";
import { createRoot } from "react-dom/client";
import { notifyManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fetchBreakdowns = vi.hoisted(() => vi.fn(async () => []));
const points = vi.hoisted(() => ({ revision: 0, listeners: new Set<() => void>() }));

vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 1 } }));
vi.mock("@bibliothecadao/eternum/game-client", () => ({ requireShard: () => ({ url: "http://herald.test" }) }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@/services/leaderboard/player-activity-breakdown-service", () => ({
  fetchLeaderboardActivityBreakdowns: fetchBreakdowns,
}));
// The points revision as the native store reports it: a player's points changing moves it.
vi.mock("@/hooks/helpers/use-native-facts", async () => {
  const { useSyncExternalStore } = await import("react");
  return {
    useNativeRevision: () =>
      useSyncExternalStore(
        (changed: () => void) => {
          points.listeners.add(changed);
          return () => points.listeners.delete(changed);
        },
        () => points.revision,
      ),
  };
});

import { useConnectionStore } from "@/hooks/store/use-connection-store";
import { useLeaderboardActivity } from "./use-leaderboard-activity";

const pointsChange = () => {
  points.revision += 1;
  points.listeners.forEach((changed) => changed());
};
const head = (block: number) => act(async () => useConnectionStore.getState().recordConfirmedHead(block));

const Panel = () => {
  useLeaderboardActivity();
  return null;
};

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  notifyManager.setNotifyFunction((notify) => act(notify));
  fetchBreakdowns.mockClear();
});

afterEach(() => notifyManager.setNotifyFunction((notify) => notify()));

it("reads the breakdown again at the first confirmed head after a points change, and never on a head without one", async () => {
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Panel />
      </QueryClientProvider>,
    ),
  );
  expect(fetchBreakdowns).toHaveBeenCalledTimes(1);
  for (let block = 1; block <= 5; block++) await head(block);
  expect(fetchBreakdowns).toHaveBeenCalledTimes(1);

  await act(async () => pointsChange());
  expect(fetchBreakdowns).toHaveBeenCalledTimes(1);
  await head(6);
  expect(fetchBreakdowns).toHaveBeenCalledTimes(2);
  await head(7);
  expect(fetchBreakdowns).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
