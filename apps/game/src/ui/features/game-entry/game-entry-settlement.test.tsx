import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settled: false,
  navigate: vi.fn(),
  milestone: vi.fn(),
  entry: {
    game_id: 8,
    name: "frontier",
    mode: "frontier",
    dev_mode_on: false,
    ready: true,
    clock: { start_settling_at: 1, start_main_at: 1, end_at: 9999999999 },
  },
}));
vi.mock("react-router-dom", async (original) => ({
  ...(await original<typeof import("react-router-dom")>()),
  useNavigate: () => state.navigate,
}));
vi.mock("@/hooks/use-game-entry", () => ({ useGameEntry: () => ({ data: state.entry, error: null }) }));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    hasSettlementRecord: state.settled,
    hasSettledStructure: state.settled,
    settledCount: state.settled ? 1 : 0,
  }),
}));
vi.mock("./selected-world-entity-wait", () => ({
  waitForSelectedWorldEntityState: async ({ read }: { read: () => Promise<unknown> }) => read(),
  isSelectedWorldEntityWaitAborted: () => false,
}));
vi.mock("@/services/settlement", () => ({
  submitSettlement: async () => {
    state.settled = true;
  },
}));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({ markGameEntryMilestone: state.milestone }));

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { GameEntryModal } from "./game-entry-modal";

afterEach(() => vi.useRealTimers());
it.each(["play", "settle"] as const)(
  "enters once after founding for %s intent, with no delayed navigation after unmount",
  async (entryIntent) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    state.settled = false;
    state.navigate.mockClear();
    state.milestone.mockClear();
    useAccountStore.setState({ account: { address: "0x111" } as never });
    useIdentitySessionStore.setState({ status: "signed-in" });
    const root = createRoot(document.createElement("div"));
    await act(async () =>
      root.render(
        <MemoryRouter>
          <GameEntryModal isOpen game={{ chainId: "0xa1", gameId: 8 }} entryIntent={entryIntent} />
        </MemoryRouter>,
      ),
    );
    try {
      expect(state.navigate).toHaveBeenCalledTimes(1);
      expect(state.milestone.mock.calls.filter(([name]) => name === "enter-game-started")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
    }
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(state.navigate).toHaveBeenCalledTimes(1);
  },
);
