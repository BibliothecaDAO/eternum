import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
vi.mock("@/hooks/context/identity-session", async (original) => {
  const identity = await original<typeof import("@/hooks/context/identity-session")>();
  return { ...identity, useIdentitySession: () => identity.useIdentitySessionStore() };
});
vi.mock("@/hooks/use-game-entry", () => ({ useGameEntry: () => ({ data: state.entry, error: null }) }));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    heldRealmId: null,
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
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
    // The relay registers the home's source before founding: this account names no Realm and holds no ticket.
    vi.stubGlobal("fetch", async () => Response.json({}));
    const host = document.createElement("div");
    const root = createRoot(host);
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () =>
      root.render(
        <QueryClientProvider client={query}>
          <MemoryRouter>
            <GameEntryModal isOpen game={{ chainId: "0xa1", gameId: 8 }} entryIntent={entryIntent} />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    try {
      expect(state.navigate).not.toHaveBeenCalled();
      const found = [...host.querySelectorAll("button")].find((button) => button.textContent === "Found your realm")!;
      await act(async () => found.click());
      expect(state.navigate).toHaveBeenCalledTimes(1);
      expect(state.milestone.mock.calls.filter(([name]) => name === "enter-game-started")).toHaveLength(1);
    } finally {
      await act(async () => root.unmount());
      query.clear();
    }
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(state.navigate).toHaveBeenCalledTimes(1);
  },
);
