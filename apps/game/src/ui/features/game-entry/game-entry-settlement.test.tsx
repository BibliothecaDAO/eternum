import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  settled: false,
  entryLoading: false,
  /** What each founding asked the chain for: settle_season's props, the signer left out. */
  founded: [] as { aspect?: number; selectedRealm?: number }[],
  navigate: vi.fn(),
  milestone: vi.fn(),
  entry: {
    game_id: 8,
    name: "frontier",
    mode: "frontier",
    dev_mode_on: false,
    preset_id: 5,
    ready: true,
    clock: { start_settling_at: 1, start_main_at: 1, scheduled_end_at: 9999999999,
end_at: 9999999999 },
    aspect_members: undefined as Record<number, number> | undefined,
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
vi.mock("@/hooks/use-game-entry", () => ({
  useGameEntry: () => ({ data: state.entryLoading ? undefined : state.entry, error: null }),
}));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    heldRealmId: null,
    hasSettlementRecord: state.settled,
    hasSettledStructure: state.settled,
    settledCount: state.settled ? 1 : 0,
  }),
}));
// The indexer answers a moment after the founding, as it does live: the page draws what each read learns meanwhile.
vi.mock("./selected-world-entity-wait", () => ({
  waitForSelectedWorldEntityState: async ({ read }: { read: () => Promise<unknown> }) => {
    const observation = await read();
    await new Promise((indexed) => setTimeout(indexed, 50));
    return observation;
  },
  isSelectedWorldEntityWaitAborted: () => false,
}));
vi.mock("@/services/settlement", () => ({
  submitSettlement: async (
    _context: unknown,
    submit: (client: { setup: { systemCalls: { settle_season: (props: never) => Promise<void> } } }) => Promise<void>,
  ) => {
    await submit({
      setup: {
        systemCalls: {
          settle_season: async ({ aspect, selectedRealm }: { aspect?: number; selectedRealm?: number }) => {
            state.founded.push({ aspect, selectedRealm });
          },
        },
      },
    });
    state.settled = true;
  },
}));
vi.mock("@/ui/layouts/game-entry-timeline", () => ({ markGameEntryMilestone: state.milestone }));

import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { ASPECT_STEP_WORDS } from "@/ui/design-system/kit/words";
import { GameEntryModal } from "./game-entry-modal";
import { FRONTIER_S1_PRESET_ID } from "../../../../../../config/source/common/native-preset-modes";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
/** Opens the entry for a Frontier account with nothing to choose; returns its page and a way to close it. */
const openEntry = async (entryIntent: "play" | "settle") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  state.navigate.mockClear();
  state.milestone.mockClear();
  useAccountStore.setState({ account: { address: "0x111" } as never });
  // An account with no linked wallet and no ticket: nothing to choose, so its free home is created without a press.
  useIdentitySessionStore.setState({
    status: "signed-in",
    session: {
      session: { id: "s", expiresAt: "2099-01-01T00:00:00Z", userId: "u" },
      user: { id: "u", realmsId: "0x2", address: null, name: "u", email: "u@test" },
    } as never,
  });
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
  await act(async () => vi.advanceTimersByTimeAsync(0));
  await act(async () => vi.advanceTimersByTimeAsync(100));
  return {
    host,
    close: async () => {
      await act(async () => root.unmount());
      query.clear();
    },
  };
};

const enteredAt = () => String(state.navigate.mock.calls[0]?.[0]);

it.each(["play", "settle"] as const)(
  "enters once after founding for %s intent, into the new realm, with no delayed navigation after unmount",
  async (entryIntent) => {
    state.settled = false;
    const { host, close } = await openEntry(entryIntent);
    try {
      expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Create your realm")).toBe(
        false,
      );
      expect(state.navigate).toHaveBeenCalledTimes(1);
      // The realm just created is where its player arrives, to build: the map boots, then hands off to it.
      expect(enteredAt()).toBe("/g/0xa1/8/map?boot=map-first&resumeScene=hex");
      expect(state.milestone.mock.calls.filter(([name]) => name === "enter-game-started")).toHaveLength(1);
    } finally {
      await close();
    }
    await act(async () => vi.advanceTimersByTimeAsync(1001));
    expect(state.navigate).toHaveBeenCalledTimes(1);
  },
);

it("opens a returning player's session on the map: only the entry that created the realm arrives in it", async () => {
  state.settled = true;
  const { close } = await openEntry("play");
  try {
    expect(state.navigate).toHaveBeenCalledTimes(1);
    expect(enteredAt()).toBe("/g/0xa1/8/map");
  } finally {
    await close();
  }
});

it("asks a Season 1 free home for its Aspect, founds nothing without a tap, and founds into the one tapped", async () => {
  state.settled = false;
  state.founded = [];
  // Herald's directory row counts each Aspect's homes (AspectMembers), every Aspect named.
  state.entry = { ...state.entry, preset_id: FRONTIER_S1_PRESET_ID, aspect_members: { 1: 12, 2: 9, 3: 0, 4: 31 } };
  const { host, close } = await openEntry("settle");
  try {
    const cards = [...host.querySelectorAll<HTMLButtonElement>(".aspect-picker__card")];
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Join Might",
      "Join Harmony",
      "Join Chaos",
      "Join Guile",
    ]);
    expect(cards.map((card) => card.querySelector(".aspect-picker__members")?.textContent)).toEqual([
      ASPECT_STEP_WORDS.members(12),
      ASPECT_STEP_WORDS.members(9),
      ASPECT_STEP_WORDS.members(0),
      ASPECT_STEP_WORDS.members(31),
    ]);
    expect(state.founded).toEqual([]);
    expect(state.navigate).not.toHaveBeenCalled();
    // No other verb stands beside the cards: the tap is the founding.
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Create your realm")).toBe(
      false,
    );

    await act(async () => cards[2]!.click());
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(state.founded).toEqual([{ aspect: 3, selectedRealm: undefined }]);
    expect(state.navigate).toHaveBeenCalledTimes(1);
  } finally {
    await close();
    state.entry = { ...state.entry, preset_id: 5, aspect_members: undefined };
  }
});

it("waits for the game preset without inventing a preset or founding a home", async () => {
  state.entryLoading = true;
  state.settled = false;
  state.founded = [];
  const errors = vi.spyOn(console, "error");
  const { close } = await openEntry("play");
  try {
    expect(state.founded).toEqual([]);
    expect(state.navigate).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();
  } finally {
    await close();
    errors.mockRestore();
    state.entryLoading = false;
  }
});
