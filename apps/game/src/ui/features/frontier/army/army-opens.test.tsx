// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The real Frontier HUD on the lab's game with an army out (the lab's frontier-army view); only the network and the
// identity stand in.
vi.mock("@/hooks/context/identity-session", async (original) => ({
  ...(await original<typeof import("@/hooks/context/identity-session")>()),
  useIdentitySession: () => ({ status: "signed-out", session: null }),
}));

const { NativeFactStore } = await import("@bibliothecadao/eternum/game-client");
const { useUIStore } = await import("@/hooks/store/use-ui-store");
const { ActionPaths, ActionType } = await import("@bibliothecadao/eternum");
const { RESOURCE_PRECISION, ResourcesIds } = await import("@bibliothecadao/types");
const active = await import("@/sync/active-game-client");
const { overrideSpectateIntent } = await import("@/utils/spectator-session");
const { UnifiedHudLab } = await import("@/ui/features/debug/kit-lab/unified-hud-lab");

/** The lab realm's army out. */
const ARMY = 90;
/** Its token: its XP (260), its number (1) and its troops (5,000). */
const TOKEN = "26015,000";

let host: HTMLDivElement;
let root: Root;

const layout = (desktop: boolean) =>
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width"),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  layout(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("{}", { status: 404 })),
  );
  Element.prototype.scrollIntoView = () => {};
  // The player is on the map, where a pick in the dock selects the army in place.
  window.history.replaceState({}, "", "/g/0x1ab/1/map");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  overrideSpectateIntent(false);
  useUIStore.setState({ isSpectating: false });
  useUIStore.getState().selectOnMap(null);
  window.history.replaceState({}, "", "/");
  await act(async () => root.unmount());
  host.remove();
});

/** The HUD drawn, and the lab game's store, caught as the lab writes its army into it. */
const renderHud = async () => {
  const writes = vi.spyOn(NativeFactStore.prototype, "applyFacts");
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/unified/frontier-army"]}>
        <QueryClientProvider client={new QueryClient()}>
          <Routes>
            <Route path="unified/:view?" element={<UnifiedHudLab />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>,
    ),
  );
  const store = writes.mock.instances.at(-1) as unknown as InstanceType<typeof NativeFactStore>;
  writes.mockRestore();
  return store;
};

const panel = () => host.querySelector("[data-kit-sheet] [data-army-step='stats']");
/** The map selects the army as a click on it does; null lets go of it. */
const select = (entityId: number | null) =>
  act(async () =>
    useUIStore.getState().selectOnMap(entityId === null ? null : { kind: "army", entityId, tile: "own" }),
  );
const closePanel = () =>
  act(async () => host.querySelector<HTMLButtonElement>("[data-kit-sheet] button[aria-label='Close']")!.click());
/** The signed-in owner entered this game to spectate it (`?spectate=true`), as spectator-session latches it. */
const spectate = async () => {
  window.history.replaceState({}, "", "/g/0x1ab/1/map?spectate=true");
  overrideSpectateIntent(true);
  await act(async () => useUIStore.setState({ isSpectating: true }));
};
/** The army's row on a desktop, its token on a phone. */
const pickInDock = () =>
  act(async () =>
    [...host.querySelectorAll<HTMLButtonElement>("button")]
      .find((each) => each.getAttribute("aria-label") === "Army 1")!
      .click(),
  );

/** A phone's picked army in the action row: its token, which opens its card. */
const details = () => host.querySelector<HTMLButtonElement>('button[aria-label="Army 1: details"]');
/** Beside the picked army's token: its four sides, its stamina (its refill) and Level up. */
const sides = () =>
  [...host.querySelectorAll("[data-picked-army] > * > [role='img']")].map((side) => side.getAttribute("aria-label"));
const rowButton = (name: RegExp) =>
  [...details()!.parentElement!.querySelectorAll<HTMLButtonElement>("button")].find((button) =>
    name.test(button.getAttribute("aria-label") ?? button.textContent ?? ""),
  )!;
const staminaButton = () => rowButton(/^Refill /);
const levelUp = () => rowButton(/^Level/);
/** The lab realm's LORDS. */
const realmLords = (lords: number) => ({
  model: "ResourceBalance",
  key: `0xb5${ResourcesIds.Lords}`,
  value: {
    game_id: 1,
    entity_id: 7,
    resource_type: ResourcesIds.Lords,
    balance: String(BigInt(lords) * BigInt(RESOURCE_PRECISION)),
  },
});

describe("the army's panel on a phone (owner, 22 October 2026: mobile direction A, the map first)", () => {
  beforeEach(() => layout(false));

  it("stays closed when the map selects the army, which the action row shows with its details a tap away", async () => {
    await renderHud();
    await select(ARMY);
    expect(panel()).toBeNull();
    expect(details()).not.toBeNull();
    // The picked army takes the dock's place.
    expect(host.querySelector('nav[aria-label="Armies"]')).toBeNull();

    await act(async () => details()!.click());
    expect(panel()!.textContent).toContain("Full in");
    await closePanel();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  });

  it("shows the picked army's four sides beside its token, its stamina over Level up, and no details button", async () => {
    await renderHud();
    await select(ARMY);
    expect(sides()).toEqual(["Battle I", "Logistics I", "Scouting I", "Homecoming I"]);
    expect(staminaButton().textContent).toBe("90/150");
    expect(levelUp().textContent).toBe("Level up");
    // One way to the card: the token, which wears the army's XP, number and troops.
    expect(host.querySelectorAll('button[aria-label="Army 1: details"]')).toHaveLength(1);
    expect(details()!.textContent).toBe(TOKEN);
  });

  it("opens the army's card from its token", async () => {
    await renderHud();
    await select(ARMY);
    await act(async () => details()!.click());
    expect(panel()).not.toBeNull();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  });

  it("opens the refill's confirm from the stamina, once the realm holds its price", async () => {
    const store = await renderHud();
    await select(ARMY);
    // The lab realm holds no LORDS: the stamina reads in red and takes no press.
    expect([staminaButton().disabled, staminaButton().dataset.tone, staminaButton().textContent]).toEqual([
      true,
      "bad",
      "90/150",
    ]);

    await act(async () => store.applyFacts([realmLords(500)] as never));
    expect([staminaButton().disabled, staminaButton().dataset.tone]).toEqual([false, undefined]);
    await act(async () => staminaButton().click());
    const confirm = host.querySelector("[data-kit-sheet]")!;
    expect([...confirm.querySelectorAll("button")].map((button) => button.textContent)).toEqual(
      expect.arrayContaining(["Cancel", "Refill"]),
    );
  });

  it("opens the army's card on its level-up choices from Level up, and on its status while no level is bought", async () => {
    const store = await renderHud();
    await select(ARMY);
    await act(async () => levelUp().click());
    expect(host.querySelector("[data-kit-sheet] [data-army-step='choose']")).not.toBeNull();
    await closePanel();

    // Its XP spent, the button reads Level-ups and opens the card.
    const progress = store.require("ArmyProgress", { game_id: 1, explorer_id: ARMY });
    await act(async () =>
      store.applyFacts([{ model: "ArmyProgress", key: "0x9a2", value: { ...progress, xp: 0 } }] as never),
    );
    expect(levelUp().textContent).toBe("Level-ups");
    await act(async () => levelUp().click());
    expect(panel()).not.toBeNull();
  });

  it("picks the army from the dock without opening its panel", async () => {
    await renderHud();
    await pickInDock();
    expect(panel()).toBeNull();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  });

  /** A place on the phone's place bar, by its word (a count may stand before it). */
  const place = (word: string) =>
    act(async () =>
      [...host.querySelectorAll<HTMLButtonElement>('nav[aria-label="Places"] button')]
        .find((button) => button.textContent?.endsWith(word))!
        .click(),
    );
  const openPage = () => host.querySelector("[data-page]");
  const openSheet = () => host.querySelector("[data-kit-sheet]");

  it.each(["Research", "Feed", "Chat"])(
    "puts %s's page away for an army picked on the map behind it, so the action row answers the pick",
    async (word) => {
      await renderHud();
      await place(word);
      expect(openPage()).not.toBeNull();

      await select(ARMY);
      expect(openPage()).toBeNull();
      expect(details()).not.toBeNull();
    },
  );

  it("puts a sheet away for an army picked on the map, and keeps the army's own details opened from its row", async () => {
    await renderHud();
    await place("Menu");
    await act(async () =>
      // The Menu is a page on the place bar; its Today row opens Today's sheet.
      [...host.querySelectorAll<HTMLButtonElement>('[data-page] section[aria-label="Menu"] button')]
        .find((button) => button.textContent?.includes("Today"))!
        .click(),
    );
    expect(openSheet()).not.toBeNull();

    await select(ARMY);
    expect(openSheet()).toBeNull();
    await act(async () => details()!.click());
    expect(panel()).not.toBeNull();
  });

  it("puts a page away for a transfer pinned beside the picked army, so its choice can be taken", async () => {
    await renderHud();
    await select(ARMY);
    await place("Research");
    expect(openPage()).not.toBeNull();

    // The map pins the army's Help order on the tile beside it, as a phone's tap on the realm's holding there does.
    const beside = { col: 7, row: 7 };
    await act(async () =>
      useUIStore.setState((state) => ({
        entityActions: {
          ...state.entityActions,
          actionPaths: new Map([
            [
              ActionPaths.posKey(beside, true),
              [
                { hex: { col: 6, row: 7 }, actionType: ActionType.Move },
                { hex: beside, actionType: ActionType.Help },
              ],
            ],
          ]),
          hoveredHex: beside,
        },
      })),
    );
    expect(openPage()).toBeNull();
    expect([...host.querySelectorAll("button")].some((button) => button.textContent === "Transfer troops")).toBe(true);
    // Beside a holding the button alone names the transfer: the words stand once.
    expect(host.textContent?.split("Transfer troops")).toHaveLength(2);
  });

  it("keeps a page open on a desktop, where it stands beside the map", async () => {
    layout(true);
    await renderHud();
    await act(async () =>
      [...host.querySelectorAll<HTMLButtonElement>("button")]
        .find((button) => button.textContent === "Research")!
        .click(),
    );
    const research = () => host.querySelector('[data-page], [aria-label="Research"]');
    expect(research()).not.toBeNull();
    await select(ARMY);
    expect(research()).not.toBeNull();
  });

  it("offers no details to a signed-in owner who entered the game to spectate it", async () => {
    await renderHud();
    await spectate();
    await select(ARMY);
    expect([panel(), details()]).toEqual([null, null]);
  });
});

describe.each([["desktop", true]])("the army's panel on a %s", (_, desktop) => {
  beforeEach(() => layout(desktop));

  it("opens when the map selects the army, with its readings and no army bar under it", async () => {
    await renderHud();
    expect(panel()).toBeNull();

    await select(ARMY);
    expect(panel()!.textContent).toContain("Full in");
    expect(host.querySelector('button[aria-label="Army"]')).toBeNull();

    // Closed, the army stays selected, so the next tap on the map orders it.
    await closePanel();
    expect(panel()).toBeNull();
    expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
  });

  it("opens once for a pick of an army in the dock, and reopens for a pick of the army already selected", async () => {
    await renderHud();
    // Each opening lets go of the tapped tile once: one arbitration, not one per path.
    const opens = vi.spyOn(useUIStore.getState(), "closeSelectedTile");
    await pickInDock();
    expect(panel()).not.toBeNull();
    expect(opens).toHaveBeenCalledOnce();

    await closePanel();
    opens.mockClear();
    await pickInDock();
    expect(panel()).not.toBeNull();
    expect(opens).toHaveBeenCalledOnce();
    opens.mockRestore();
  });

  it("stays closed through the army's own facts changing and the same army selected again", async () => {
    const store = await renderHud();
    await select(ARMY);
    await closePanel();

    const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: ARMY });
    const tired = { Inline: { amount: "70", settled_at: "350000", remainder: "0" } };
    await act(async () =>
      store.applyFacts([
        { model: "ExplorerTroops", key: "0x9a0", value: { ...army, troops: { ...army.troops, stamina: tired } } },
      ] as never),
    );
    await select(ARMY);
    expect(panel()).toBeNull();

    // Let go and selected afresh, it opens.
    await select(null);
    await select(ARMY);
    expect(panel()).not.toBeNull();
  });

  it("stays closed through a visit started and left with the army still selected", async () => {
    const store = await renderHud();
    await select(ARMY);
    await closePanel();

    active.installActiveGameClient({
      setup: { store },
      connect: () => {},
      disconnect: () => {},
      visit: () => {},
      dispose: () => {},
    } as never);
    try {
      await act(async () => active.startRealmVisit({ player: "0x222", structureId: 999, opensOn: "realm" } as never));
      await act(async () => active.leaveRealmVisit());
      expect(useUIStore.getState().entityActions.selectedEntityId).toBe(ARMY);
      expect(panel()).toBeNull();
    } finally {
      active.disposeGameSyncSession();
    }
  });

  it("never opens for a signed-in owner who entered the game to spectate it", async () => {
    await renderHud();
    await spectate();
    await select(ARMY);
    expect(panel()).toBeNull();
  });

  it("never reopens from the dock (its row, its token) for that spectating owner", async () => {
    await renderHud();
    await spectate();
    await select(ARMY);
    // The army is selected: for a player the dock's pick would reopen its panel.
    await pickInDock();
    expect(panel()).toBeNull();
  });
});
