import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RESOURCE_PRECISION } from "@bibliothecadao/types";

const world = vi.hoisted(() => ({ rivalHasAspect: false }));
vi.mock("@/hooks/context/game-context", () => ({
  useGame: () => ({
    setup: {
      store: {
        require: () => ({ spacing: 1024 }),
        get: (_model: string, key: { home: bigint }) =>
          key.home === 7n ? { aspect: 1 } : world.rivalHasAspect && key.home === 8n ? { aspect: 2 } : undefined,
      },
    },
  }),
}));
vi.mock("@/hooks/helpers/use-native-facts", () => ({ useNativeRevision: () => 0 }));
vi.mock("@/runtime/world", () => ({ getActiveGame: () => ({ chainId: "0x1" }) }));
vi.mock("@bibliothecadao/eternum", () => ({ configManager: { getActiveGameId: () => 1 } }));
vi.mock("@bibliothecadao/eternum/game-client", async (original) => ({
  ...(await original<typeof import("@bibliothecadao/eternum/game-client")>()),
  requireShard: () => ({ url: "https://herald.test" }),
  fetchHeraldGameHistory: async () => ({
    total: 1,
    items: [
      {
        block_number: 5,
        transaction_index: 0,
        event_index: 1,
        game_id: "1",
        model: "BattleEvent",
        transaction_hash: "0xabc",
        value: {
          coord: { x: 512, y: 3584, alt: false },
          timestamp: "0x64",
          attacker_owner: "7",
          defender_owner: "8",
          attacker: { before: `0x${(100n * BigInt(RESOURCE_PRECISION)).toString(16)}`, after: "0x0" },
          defender: {
            before: `0x${(60n * BigInt(RESOURCE_PRECISION)).toString(16)}`,
            after: `0x${(10n * BigInt(RESOURCE_PRECISION)).toString(16)}`,
          },
        },
      },
    ],
  }),
}));

import { type AspectFeedReading, useAspectFights } from "./use-aspect-fights";

let host: HTMLDivElement;
let root: Root;
let seen: AspectFeedReading;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  root = createRoot(host);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  act(() => root.unmount());
  vi.restoreAllMocks();
});

const Reader = () => {
  seen = useAspectFights([7n]);
  return null;
};
const read = async () => {
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <Reader />
      </QueryClientProvider>,
    ),
  );
  for (let turn = 0; turn < 5; turn++) await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
};

it("keeps loading, and says so, while a Deep fight's rival has no Aspect row, rather than reporting an empty feed", async () => {
  world.rivalHasAspect = false;
  await read();
  expect(seen.status).toBe("loading");
  expect(console.error).toHaveBeenCalledWith(expect.stringContaining("no Aspect row"));
});

it("lists the fight once both sides have their Aspect", async () => {
  world.rivalHasAspect = true;
  await read();
  expect(seen.status === "ready" && seen.fights.map((fight) => fight.outcome)).toEqual(["defender"]);
});
