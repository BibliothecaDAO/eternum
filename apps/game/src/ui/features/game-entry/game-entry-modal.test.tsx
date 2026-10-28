// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { getBlockTimestamp } from "@bibliothecadao/eternum";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const settlement = vi.hoisted(() => ({
  settled: false,
  heldRealmId: null as number | null,
  calls: [] as unknown[],
  order: [] as string[],
}));

const GAME = { chainId: "0x5245414c4d53", gameId: 8 };
const HELD_REALMS = "/api/value/held-realms";

vi.mock("@/hooks/context/identity-session", async (original) => {
  const identity = await original<typeof import("@/hooks/context/identity-session")>();
  return { ...identity, useIdentitySession: () => identity.useIdentitySessionStore() };
});
vi.mock("@/hooks/use-game-entry", () => ({
  useGameEntry: () => {
    const now = Math.floor(Date.now() / 1000);
    const entry = {
      game_id: GAME.gameId,
      name: "frontier-staging",
      mode: "frontier",
      dev_mode_on: false,
      player_state: { structures: [{ entity_id: 7, category: 1, realm_id: 3098, level: 2 }] },
      clock: { start_settling_at: now - 60, start_main_at: now - 60, end_at: now + 3_600 },
    };
    return { data: entry, error: null };
  },
}));
vi.mock("@/runtime/world/herald-pre-session-reader", () => ({
  fetchSettlementSnapshot: async () => ({
    heldRealmId: settlement.heldRealmId,
    hasSettlementRecord: settlement.settled,
    hasSettledStructure: settlement.settled,
    settledCount: settlement.settled ? 1 : 0,
  }),
}));

vi.mock("@/services/settlement", () => ({
  submitSettlement: async (_context: unknown, submit: (client: unknown) => Promise<unknown>) => {
    const result = await submit({
      setup: {
        systemCalls: {
          settle_season: async (props: unknown) => {
            settlement.order.push("settle");
            settlement.calls.push(props);
            settlement.settled = true;
            return { transaction_hash: "0xabc" };
          },
        },
      },
    });
    return result;
  },
}));
vi.mock("./selected-world-entity-wait", () => ({
  isSelectedWorldEntityWaitAborted: () => false,
  waitForSelectedWorldEntityState: async (input: { read: () => Promise<unknown> }) => input.read(),
}));
import { useAccountStore } from "@/hooks/store/use-account-store";
import { useIdentitySessionStore } from "@/hooks/context/identity-session";
import { GameEntryModal } from "./game-entry-modal";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  settlement.settled = false;
  settlement.heldRealmId = null;
  settlement.calls = [];
  settlement.order = [];
  useAccountStore.setState({ account: null });
  useIdentitySessionStore.setState({ status: "loading", session: null });
});

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
          <GameEntryModal isOpen game={GAME} isSpectateMode />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  try {
    expect(container.querySelector("[aria-label='Entering the game']")).not.toBeNull();
    expect(useChainTimeStore.getState().nowMs).toBeNull();
    expect(() => getBlockTimestamp()).toThrow("Chain time is not known yet");
  } finally {
    await act(async () => root.unmount());
  }
});

it.each(["", "711", "registered"])(
  "founds from the player's button, registering its source first: a typed held Realm, else any campaign ticket (%s)",
  async (number) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    if (number === "registered") settlement.heldRealmId = 711;
    const signer = { address: "0x123" } as never;
    useAccountStore.setState({ account: signer });
    useIdentitySessionStore.setState({ status: "signed-in" });
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (url === HELD_REALMS) return Response.json({ error: "realm_holdings_unavailable" }, { status: 503 });
      settlement.order.push("register");
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ realmId: 711 });
    });
    const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const host = document.createElement("div");
    const root = createRoot(host);
    try {
      await act(async () =>
        root.render(
          <QueryClientProvider client={query}>
            <MemoryRouter>
              <GameEntryModal isOpen game={GAME} />
            </MemoryRouter>
          </QueryClientProvider>,
        ),
      );
      expect(settlement.calls).toEqual([]);
      const input = host.querySelector<HTMLInputElement>('input[aria-label="Realm number"]')!;
      expect(input).not.toBeNull();
      if (number === "registered") {
        expect(input.value).toBe("711");
        expect(input.disabled).toBe(true);
      }
      if (number === "711")
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, number);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      const found = [...host.querySelectorAll("button")].find((button) => button.textContent === "Found your realm")!;
      await act(async () => found.click());
      expect(settlement.calls).toEqual([{ signer, selectedRealm: undefined }]);
      expect(settlement.order).toEqual(number === "registered" ? ["settle"] : ["register", "settle"]);
      const url = `/api/value/realm-entry?chainId=${GAME.chainId}`;
      expect(sent).toEqual(
        number === "registered" ? [] : [{ url, body: number === "711" ? { gameId: 8, realmId: 711 } : { gameId: 8 } }],
      );
      expect(settlement.settled).toBe(true);
    } finally {
      await act(async () => root.unmount());
      query.clear();
    }
  },
);

it.each(["", "712"])("lets a refused Realm claimant found with a new choice (%s)", async (alternative) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const signer = { address: "0x124" } as never;
  useAccountStore.setState({ account: signer });
  useIdentitySessionStore.setState({ status: "signed-in" });
  const sent: number[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return Response.json({ realms: [] });
    const { realmId } = JSON.parse(String(init.body));
    sent.push(realmId);
    return realmId === 711
      ? Response.json({ error: "realm_registration_refused" }, { status: 409 })
      : Response.json({ realmId });
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={query}>
          <MemoryRouter>
            <GameEntryModal isOpen game={GAME} />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    const input = () => host.querySelector<HTMLInputElement>('input[aria-label="Realm number"]')!;
    const choose = async (number: string) =>
      act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), number);
        input().dispatchEvent(new Event("input", { bubbles: true }));
      });
    const found = async () =>
      act(async () => {
        [...host.querySelectorAll("button")].find((button) => button.textContent === "Found your realm")!.click();
      });
    await choose("711");
    await found();
    expect(settlement.calls).toEqual([]);
    expect(input().disabled).toBe(false);
    expect(host.textContent).toContain("Choose another Realm or leave blank.");
    await choose(alternative);
    await found();
    expect(sent).toEqual(alternative === "" ? [711, undefined] : [711, 712]);
    expect(settlement.calls).toEqual([{ signer, selectedRealm: undefined }]);
    expect(settlement.settled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    query.clear();
  }
});

it("lets a holder pick their Realm from the ones their wallet holds, and found with it", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const signer = { address: "0x123" } as never;
  useAccountStore.setState({ account: signer });
  useIdentitySessionStore.setState({ status: "signed-in" });
  const sent: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return Response.json({ realms: [3, 711] });
    sent.push(JSON.parse(String(init.body)));
    return Response.json({ realmId: 711 });
  });
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={query}>
          <MemoryRouter>
            <GameEntryModal isOpen game={GAME} />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
    );
    await vi.waitFor(() => expect(host.querySelector('[role="group"][aria-label="Your Realms"]')).not.toBeNull());
    const yours = host.querySelector('[role="group"][aria-label="Your Realms"]')!;
    expect([...yours.querySelectorAll("button")].map((chip) => chip.textContent)).toEqual(["3", "711"]);
    await act(async () => [...yours.querySelectorAll("button")].find((chip) => chip.textContent === "711")!.click());
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Realm number"]')!.value).toBe("711");
    await act(async () =>
      [...host.querySelectorAll("button")].find((button) => button.textContent === "Found your realm")!.click(),
    );
    expect(sent).toEqual([{ gameId: 8, realmId: 711 }]);
    expect(settlement.settled).toBe(true);
  } finally {
    await act(async () => root.unmount());
    query.clear();
  }
});
