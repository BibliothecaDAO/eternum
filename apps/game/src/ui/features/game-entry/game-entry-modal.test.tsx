// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";

import { canonicalRealm, getBlockTimestamp, homeDailyClaim } from "@bibliothecadao/eternum";
import { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { IdentityRequestError } from "@realms-world/identity";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";

const settlement = vi.hoisted(() => ({
  settled: false,
  /** The game's preset: Frontier's (1), or the Devcon season's (6), whose homes a Devcon ticket founds. */
  presetId: 1,
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
      preset_id: settlement.presetId,
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
import { identityClient, useIdentitySessionStore } from "@/hooks/context/identity-session";
import { campaignHomeFacts } from "@/lab/game/campaign-scenario";
import { GameEntryModal } from "./game-entry-modal";
import type { Session } from "@realms-world/identity";

/** A signed-in Realms account whose linked wallet is `address` (null: none linked). */
const signedIn = (realmsId: string, address: string | null): Session => ({
  session: { id: `session-${realmsId}`, expiresAt: "2099-01-01T00:00:00Z", userId: realmsId },
  user: { id: realmsId, realmsId, address, name: realmsId, email: `${realmsId}@test` },
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  settlement.settled = false;
  settlement.presetId = 1;
  settlement.heldRealmId = null;
  settlement.calls = [];
  settlement.order = [];
  useAccountStore.setState({ account: null });
  useIdentitySessionStore.setState({ status: "loading", session: null });
});

/** The account holds no campaign ticket: identity answers a ticket read with no code so. */
const noTicket = () =>
  vi
    .spyOn(identityClient, "redeemCampaignTicket")
    .mockRejectedValue(new IdentityRequestError(400, "invalid_redemption"));

/** The entry modal on its game, with Settings beside it for the wallet link's detour. */
const openEntry = async () => {
  const query = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const host = document.createElement("div");
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={query}>
        <MemoryRouter initialEntries={["/play/frontier"]}>
          <Routes>
            <Route path="/profile/settings" element={<p>Settings page</p>} />
            <Route path="*" element={<GameEntryModal isOpen game={GAME} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  );
  const yourRealms = () =>
    [...(host.querySelector('[role="group"][aria-label="Your Realms"]')?.querySelectorAll("button") ?? [])].map(
      (chip) => chip.textContent,
    );
  const press = async (text: string) =>
    act(async () => [...host.querySelectorAll("button")].find((button) => button.textContent === text)!.click());
  const close = async () => {
    await act(async () => root.unmount());
    query.clear();
  };
  return { host, yourRealms, press, close };
};

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
  "founds from the player's button, registering its source first: a typed Realm while the holdings cannot be read, else any campaign ticket (%s)",
  async (number) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    if (number === "registered") settlement.heldRealmId = 711;
    const signer = { address: "0x123" } as never;
    useAccountStore.setState({ account: signer });
    useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
    noTicket();
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      if (url === HELD_REALMS) return Response.json({ error: "realm_holdings_unavailable" }, { status: 503 });
      settlement.order.push("register");
      sent.push({ url, body: JSON.parse(String(init.body)) });
      return Response.json({ realmId: 711 });
    });
    const entry = await openEntry();
    try {
      expect(settlement.calls).toEqual([]);
      await vi.waitFor(() => expect(entry.host.textContent).toContain("Your Realms cannot be read right now"));
      const input = entry.host.querySelector<HTMLInputElement>('input[aria-label="Realm number"]')!;
      if (number === "registered") {
        expect(input.value).toBe("711");
        expect(input.disabled).toBe(true);
      }
      if (number === "711")
        await act(async () => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, number);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        });
      await entry.press("Found your realm");
      expect(settlement.calls).toEqual([{ signer, selectedRealm: undefined }]);
      expect(settlement.order).toEqual(number === "registered" ? ["settle"] : ["register", "settle"]);
      const url = `/api/value/realm-entry?chainId=${GAME.chainId}`;
      expect(sent).toEqual(
        number === "registered" ? [] : [{ url, body: number === "711" ? { gameId: 8, realmId: 711 } : { gameId: 8 } }],
      );
      expect(settlement.settled).toBe(true);
    } finally {
      await entry.close();
    }
  },
);

/** A held Realm's chip as the step shows it: its number and its name. */
const realmChip = (realmId: number) => `${realmId} · ${canonicalRealm(realmId)!.name}`;

it.each(["", "712"])("lets a refused Realm claimant found with a new choice (%s)", async (alternative) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const signer = { address: "0x124" } as never;
  useAccountStore.setState({ account: signer });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
  noTicket();
  const sent: number[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return Response.json({ realms: [711, 712] });
    const { realmId } = JSON.parse(String(init.body));
    sent.push(realmId);
    return realmId === 711
      ? Response.json({ error: "realm_registration_refused" }, { status: 409 })
      : Response.json({ realmId });
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(711), realmChip(712)]));
    await entry.press(realmChip(711));
    await entry.press("Found your realm");
    expect(settlement.calls).toEqual([]);
    expect(entry.host.textContent).toContain("Choose another Realm or leave blank.");
    // Pressing the picked Realm again lets it go; pressing another picks that one.
    await entry.press(alternative === "" ? realmChip(711) : realmChip(712));
    await entry.press("Found your realm");
    expect(sent).toEqual(alternative === "" ? [711, undefined] : [711, 712]);
    expect(settlement.calls).toEqual([{ signer, selectedRealm: undefined }]);
    expect(settlement.settled).toBe(true);
  } finally {
    await entry.close();
  }
});

it("lets a holder pick their Realm from the ones their wallet holds, and found with it", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
  noTicket();
  const sent: unknown[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === HELD_REALMS) return Response.json({ realms: [3, 711] });
    sent.push(JSON.parse(String(init.body)));
    return Response.json({ realmId: 711 });
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(3), realmChip(711)]));
    // With the holdings read, the Realm is picked, never typed.
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
    await entry.press(realmChip(711));
    const picked = [...entry.host.querySelectorAll('[aria-label="Your Realms"] button')].filter(
      (chip) => chip.getAttribute("data-tone") === "good",
    );
    expect(picked.map((chip) => chip.textContent)).toEqual([realmChip(711)]);
    await entry.press("Found your realm");
    expect(sent).toEqual([{ gameId: 8, realmId: 711 }]);
    expect(settlement.settled).toBe(true);
  } finally {
    await entry.close();
  }
});

it("shows each account its own Realms in the same tab: another account or a changed wallet asks again", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
  noTicket();
  /** The relay answers for whichever account the session cookie names, by its linked wallet. */
  const holdings: Record<string, number[]> = { "0x456": [711], "0x789": [934], "0xabc": [12] };
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    if (url !== HELD_REALMS) return Response.json({ realmId: 711 });
    const wallet = useIdentitySessionStore.getState().session!.user.address!;
    asked.push(wallet);
    return Response.json({ realms: holdings[wallet] });
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(711)]));
    await act(async () => useIdentitySessionStore.getState().applySession(null));
    useAccountStore.setState({ account: { address: "0x124" } as never });
    await act(async () => useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x3", "0x789") }));
    await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(934)]));
    await act(async () => useIdentitySessionStore.setState({ session: signedIn("0x3", "0xabc") }));
    await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(12)]));
    expect(asked).toEqual(["0x456", "0x789", "0xabc"]);
  } finally {
    await entry.close();
  }
});

it("tells a player with no linked wallet why no Realm is listed, and takes them to link one", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", null) });
  noTicket();
  const asked: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    asked.push(url);
    return Response.json({});
  });
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.textContent).toContain("No wallet linked"));
    expect(entry.host.textContent).toContain("Free home · no daily Labor");
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
    expect(asked).not.toContain(HELD_REALMS);
    await entry.press("Link wallet");
    expect(entry.host.textContent).toContain("Settings page");
  } finally {
    await entry.close();
  }
});

it("tells a linked holder of no Realm so, rather than listing nothing", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  useAccountStore.setState({ account: { address: "0x123" } as never });
  useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
  noTicket();
  vi.stubGlobal("fetch", async () => Response.json({ realms: [] }));
  const entry = await openEntry();
  try {
    await vi.waitFor(() => expect(entry.host.textContent).toContain("Your linked wallet holds no Realm"));
    expect(entry.host.querySelector('input[aria-label="Realm number"]')).toBeNull();
  } finally {
    await entry.close();
  }
});

/** A Devcon season's LaborRules row, as the contract holds it in a founded game. */
const devconRules = campaignHomeFacts("regular")[0]!;

it.each([
  {
    home: "a free home",
    ticket: null,
    pick: null,
    founded: [devconRules],
    line: "Free home · no daily Labor",
  },
  {
    home: "a regular Devcon ticket's",
    ticket: "regular" as const,
    pick: null,
    founded: campaignHomeFacts("regular"),
    line: "Devcon home · 1,000 Labor · 1,000 Essence each day",
  },
  {
    home: "a golden Devcon ticket's",
    ticket: "golden" as const,
    pick: null,
    founded: campaignHomeFacts("golden"),
    line: "Golden Devcon home · 2,000 Labor · 2,000 Essence each day",
  },
  {
    home: "a held Realm's, picked over a ticket",
    ticket: "regular" as const,
    pick: 711,
    founded: [devconRules, { model: "SettledRealm", key: "0x1b32", value: { game_id: 1, realm_id: 711, home: 7 } }],
    line: `${realmChip(711)} · 1,000 Labor each day`,
  },
])(
  "says what $home home claims each day, as the founded home then claims it",
  async ({ ticket, pick, founded, line }) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    settlement.presetId = 6;
    useAccountStore.setState({ account: { address: "0x123" } as never });
    useIdentitySessionStore.setState({ status: "signed-in", session: signedIn("0x2", "0x456") });
    if (ticket)
      vi.spyOn(identityClient, "redeemCampaignTicket").mockResolvedValue({ campaign: "devcon-2026", tier: ticket });
    else noTicket();
    vi.stubGlobal("fetch", async () => Response.json({ realms: [711] }));

    // The home as the contract founds it from that source, read by the Realm sheet and the Day open push alike.
    const store = new NativeFactStore();
    store.applyFacts(founded as never);
    const claim = homeDailyClaim(store, { gameId: 1, entityId: 7, realmId: 711 });
    const amounts = claim
      ? [
          `${claim.labor.toLocaleString("en-US")} Labor`,
          ...(claim.essence ? [`${claim.essence.toLocaleString("en-US")} Essence`] : []),
        ]
      : [];
    expect(amounts.every((amount) => line.includes(amount))).toBe(true);
    expect(claim === null).toBe(line === "Free home · no daily Labor");

    const entry = await openEntry();
    try {
      await vi.waitFor(() => expect(entry.yourRealms()).toEqual([realmChip(711)]));
      if (pick) await entry.press(realmChip(pick));
      await vi.waitFor(() => expect(entry.host.textContent).toContain(line));
    } finally {
      await entry.close();
    }
  },
);
