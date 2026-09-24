// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const GAME = { chainId: "0x5245414c4d53", gameId: 8 };

vi.mock("@/hooks/use-game-entry", () => ({
  useGameEntry: () => {
    const now = Math.floor(Date.now() / 1000);
    const entry = {
      game_id: GAME.gameId,
      name: "frontier-staging",
      mode: "frontier",
      dev_mode_on: false,
      clock: { start_settling_at: now - 60, start_main_at: now - 60, end_at: now + 3_600 },
    };
    return { data: entry, error: null };
  },
}));
vi.mock("@/hooks/use-village-pass-inventory", () => ({
  useVillagePassInventory: () => ({
    villagePassBalance: 0n,
    villagePasses: [],
    isLoading: false,
    error: null,
    refetch: async () => undefined,
  }),
}));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchPlayerStructures: async () => [],
  fetchSettlementSnapshot: async () => null,
}));

import { GameEntryModal } from "./game-entry-modal";

afterEach(() => vi.restoreAllMocks());

it("renders spectator entry before any head without reading the chain clock", async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useChainTimeStore.setState({
    lastHeartbeat: null,
    executionFloorMs: null,
    anchorTimestampMs: null,
    anchorPerfMs: null,
    nowMs: null,
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement("div");
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <GameEntryModal isOpen onClose={() => undefined} game={GAME} isSpectateMode />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  try {
    expect(container.textContent).toContain("frontier-staging");
    expect(useChainTimeStore.getState().nowMs).toBeNull();
    expect(() => getBlockTimestamp()).toThrow("Chain time is not known yet");
  } finally {
    await act(async () => root.unmount());
  }
});
