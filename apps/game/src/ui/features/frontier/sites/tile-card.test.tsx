import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentBlockTimestamp: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 350,
  useBlockTimestamp: () => ({ currentArmiesTick: 3, armiesTickTimeRemaining: 60 }),
}));
vi.mock("@/audio/unit-command-audio", () => ({ playUnitCommandSound: () => {} }));
/** The outcome of the action the card sent, settled by each test: applied unless it says otherwise. */
const waitForAction = vi.fn();
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => ({ waitForAction }),
}));

import { GameProvider } from "@/hooks/context/game-context";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { acceptGameSyncStoryEvent, resetGameSyncStoryEvents } from "@/hooks/store/use-story-events-store";
import { ARMY_SELECT_REQUEST_EVENT, takeArmySelectRequest } from "@/three/scenes/worldmap-army-select-request";
import { inFlight, sendOnce } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActionPaths, ActionType, setBlockTimestampSource, setEntityNameLocalStorage } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { siteName } from "@bibliothecadao/types";
import type { ComponentProps } from "react";
import { MemoryRouter } from "react-router-dom";
import { useArmyPanelOpens } from "../army/army-opens";
import { useOnePanel } from "../hud/one-panel";
import { campBeside, otherArmyAt, SITE, SITE_TILE } from "./site-fixture";
import { TileCard } from "./tile-card";

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };

beforeEach(() => {
  waitForAction.mockReset();
  waitForAction.mockResolvedValue(APPLIED);
});

afterEach(() => {
  resetGameSyncStoryEvents();
  setBlockTimestampSource(null);
  useUIStore.getState().selectOnMap(null);
  useUIStore.getState().updateEntityActionActionPaths(new Map());
});

const whole = (troops: number) => String(BigInt(troops) * 1_000_000_000n);
let battles = 0;
/** The battle an attack fought, reaching the client with the action's facts: both sides before and after. */
const battleArrives = (army: [number, number], guard: [number, number], defenderId: number = SITE) =>
  acceptGameSyncStoryEvent(
    {
      model: "BattleEvent",
      key: `0xbattle${battles}`,
      value: {
        game_id: "0x1",
        attacker_id: 201,
        defender_id: defenderId,
        attacker: { before: whole(army[0]), after: whole(army[1]) },
        defender: { before: whole(guard[0]), after: whole(guard[1]) },
        timestamp: 350,
        event_position: { block_number: 9, transaction_hash: "0x1", transaction_index: 0, event_index: battles++ },
      },
    },
    { chainId: "0x1", worldAddress: "0xabc", gameId: 1 },
  );

/** Whether the map's selection is an army acting on the fixture's camp, which opens the camp's card. */
const actsOnTheSite = (selection: ReturnType<typeof useUIStore.getState>["mapSelection"]) =>
  selection?.kind === "army" &&
  typeof selection.tile === "object" &&
  selection.tile?.col === SITE_TILE.col &&
  selection.tile.row === SITE_TILE.row;

/**
 * The card inside the HUD's arbitration, as frontier-hud.tsx wires it: the one panel (a new card puts the army's panel
 * away), the army's panel opening on selection (a desktop's), and the card's way back to the army. The army's panel
 * stands in as a marked section.
 */
const InTheHud = ({
  desktop,
  realm,
  ...card
}: { desktop: boolean; realm: Parameters<typeof useArmyPanelOpens>[0] } & Omit<
  ComponentProps<typeof TileCard>,
  "onArmyBack"
>) => {
  const onTheSite = useUIStore((state) => actsOnTheSite(state.mapSelection));
  const { surface, openSurface, showsCard } = useOnePanel(onTheSite ? "target" : null, !desktop);
  const armyPanel = useArmyPanelOpens(realm, () => openSurface("army"), desktop);
  return (
    <>
      {showsCard && <TileCard {...card} onArmyBack={armyPanel.returnTo} />}
      {surface === "army" && <section aria-label="Army details" />}
    </>
  );
};

/**
 * The card over the fixture's camp, its army beside it or moved away to stand out of reach: alone, or inside a
 * desktop's or a phone's HUD.
 */
const renderCard = (army: "beside" | "far", hud?: "desktop" | "phone") => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const { store, site, structure } = campBeside();
  const standsAt = { game_id: 1, alt: false, col: 60, row: 12, entity_id: 201, category: 15, is_structure: false };
  if (army === "far")
    store.applyFacts([
      { model: "TileOccupancy", key: "0x75", value: null },
      { model: "TileOccupancy", key: "0x77", value: standsAt },
    ] as never);
  useAccountStore.setState({ account: { address: "0x111" } as never });
  const attack = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
  const tile = { hexCoords: SITE_TILE, biome: 11, occupierId: SITE } as unknown as TileSpatialRenderable;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider
        value={{ store, systemCalls: { attack_explorer_vs_guard: attack } } as unknown as GameClientSetup}
        account={{ address: "0x111" } as never}
      >
        {hud ? (
          <MemoryRouter>
            <InTheHud
              desktop={hud === "desktop"}
              realm={store.require("Structure", { game_id: 1, entity_id: 7 })}
              selected={{ kind: "site", site, structure, tile }}
              onClose={() => {}}
            />
          </MemoryRouter>
        ) : (
          <TileCard selected={{ kind: "site", site, structure, tile }} onClose={() => {}} onArmyBack={() => {}} />
        )}
      </GameProvider>,
    ),
  );
  const button = (word: string) =>
    [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(word));
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, store, attack, button, unmount };
};

describe("the tile card", () => {
  it("titles the site by its map name over its kind, names the guard, offers no Attack until an army is chosen, then attacks with the same tap", async () => {
    const { host, attack, button, unmount } = renderCard("beside");
    try {
      const card = host.querySelector(`section[aria-label="${siteName(SITE)}"]`);
      expect(card).not.toBeNull();
      expect(card!.querySelector(".ui-sheet__body header")?.textContent).toBe("+550+82 XPTroll1.1K");
      expect(host.querySelector('[aria-label="Beast 1.1K"]')).not.toBeNull();
      expect(button("Attack")).toBeUndefined();

      act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
      // With an army chosen, the headline is the attack's; the Troll is its painting and the guard's side.
      expect(card!.querySelectorAll('[data-icon="beast-troll"]')).toHaveLength(2);
      expect(button("Attack")?.disabled).toBe(false);
      await act(async () => button("Attack")!.click());
      expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
    } finally {
      unmount();
    }
  });

  it("titles the site by the name its holder gave it, as its plate, its lists and its stories do", () => {
    setEntityNameLocalStorage(SITE, "North Watch");
    const { host, unmount } = renderCard("beside");
    try {
      const card = host.querySelector('section[aria-label="North Watch"]')!;
      expect(card).not.toBeNull();
      expect(card.textContent?.match(/North Watch/g)).toHaveLength(1);
      expect(card.querySelector(".ui-sheet__body header")?.textContent).toBe("+550+82 XPTroll1.1K");
      expect(card.textContent?.match(/Troll/g)).toHaveLength(1);
      expect(card.textContent).not.toMatch(/\bcamp\b/i);
    } finally {
      unmount();
      localStorage.removeItem(`entity-name-${SITE}`);
    }
  });

  it("offers Move by the order that leads beside the site, never by a tile another army of the player holds", () => {
    const { host, button, unmount } = renderCard("far");
    const path = (col: number, row: number, actionType: ActionType) => [
      { hex: { col: 60, row: 12 }, actionType: ActionType.Move },
      { hex: { col, row }, actionType },
    ];
    act(() => {
      useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null });
      useUIStore.getState().updateEntityActionActionPaths(
        new Map([
          [ActionPaths.posKey({ col: 41, row: 12 }), path(41, 12, ActionType.Help)],
          [ActionPaths.posKey({ col: 39, row: 12 }), path(39, 12, ActionType.Explore)],
        ]),
      );
    });
    expect(button("Move")?.disabled).toBe(false);
    expect(button("Attack")).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Too far from the Troll");
    unmount();
  });

  it("tells the selected army the site is too far when it stands out of reach with no order leading beside it", () => {
    const { host, button, unmount } = renderCard("far");
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
    expect(button("Attack")?.disabled).toBe(true);
    expect(button("Move")).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Too far from the Troll");
    unmount();
  });

  it("is the same card for another player's army: its troops, the forecast, and Attack sent army against army", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = campBeside();
    const other = otherArmyAt(store, 42, 12);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    const attack = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const tile = {
      hexCoords: { col: 42, row: 12, alt: false },
      biome: 11,
      occupierId: 301,
    } as unknown as TileSpatialRenderable;
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { attack_explorer_vs_explorer: attack } } as unknown as GameClientSetup}
          account={{ address: "0x111" } as never}
        >
          <TileCard selected={{ kind: "army", army: other, tile }} onClose={() => {}} onArmyBack={() => {}} />
        </GameProvider>,
      ),
    );
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
    expect(host.querySelector('section[aria-label="Army"]')).not.toBeNull();
    // The other army stands where a guard does: its 300 troops before this attack, on the guard's side.
    const sides = [...host.querySelectorAll(".ui-sheet__body > .flex.gap-2 > *")].map((side) => side.textContent);
    expect(sides[1]).toMatch(/^300 →/);
    const button = [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Attack"))!;
    await act(async () => button.click());
    expect(attack).toHaveBeenCalledWith(
      expect.objectContaining({ aggressor_id: 201, defender_id: 301, steal_resources: [] }),
    );
    act(() => root.unmount());
    host.remove();
  });
});

describe("an attack in flight on the tile card", () => {
  /** An attack whose outcome the test settles when it chooses. */
  const attackInFlight = () => {
    let settle: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (settle = resolve)));
    const card = renderCard("beside");
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: null }));
    return { ...card, settle: (outcome: unknown) => act(async () => settle(outcome)) };
  };

  it("keeps repeat presses on Attacking… until the action's own outcome arrives", async () => {
    const { button, settle, unmount } = attackInFlight();
    await act(async () => {
      // Both presses land before the card draws again: the second finds the army taken.
      button("Attack")!.click();
      button("Attack")!.click();
    });
    expect(button("Attacking…")?.disabled).toBe(true);
    expect(inFlight("army", 201)).toEqual({ order: "attack" });
    // The send returned long ago; only the outcome ends the wait.
    await act(async () => {});
    expect(button("Attacking…")?.disabled).toBe(true);
    await settle(APPLIED);
    expect(inFlight("army", 201)).toBeUndefined();
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });

  it("keeps reading Attacking… when the sheet is closed and opened again before the outcome", async () => {
    const first = attackInFlight();
    await act(async () => first.button("Attack")!.click());
    first.unmount();
    const again = renderCard("beside");
    expect(again.button("Attacking…")?.disabled).toBe(true);
    await first.settle(APPLIED);
    expect(again.button("Attack")?.disabled).toBe(false);
    again.unmount();
  });

  it("says in one line why a refused attack did not happen, and frees the army", async () => {
    const { host, button, settle, unmount } = attackInFlight();
    await act(async () => button("Attack")!.click());
    await settle({ hash: "0x1", block: 9, status: "REJECTED", revertReason: "Not enough stamina" });
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Not enough stamina");
    expect(inFlight("army", 201)).toBeUndefined();
    expect(button("Attack")?.disabled).toBe(false);
    // The next attack takes the line away.
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    await act(async () => button("Attack")!.click());
    expect(button("Attacking…")?.disabled).toBe(true);
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => apply(APPLIED));
    unmount();
  });

  it("says the same when the attack could not be sent at all", async () => {
    const { host, attack, button, unmount } = attackInFlight();
    attack.mockRejectedValueOnce(new Error("The shard refused the request"));
    await act(async () => button("Attack")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe("The shard refused the request");
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });

  it("holds Attack back while another order of the same army is still on its way", async () => {
    const { button, settle, unmount } = attackInFlight();
    let moved: Promise<string | null> = Promise.resolve(null);
    act(
      () => void (moved = sendOnce("army", 201, { order: "move" }, () => Promise.resolve({ transaction_hash: "0x2" }))),
    );
    expect(button("On its way…")?.disabled).toBe(true);
    await act(async () => button("On its way…")!.click());
    expect(button("On its way…")?.disabled).toBe(true);
    await settle(APPLIED);
    expect(await moved).toBe("0x2");
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });
});

describe("after the player's attack (owner, 27 October 2026: 'the post fight cards are pretty useless')", () => {
  const gone = (model: string, key: string) => ({ model, key, value: null });
  const ARMY_GONE = [gone("ExplorerTroops", "0x74"), gone("TileOccupancy", "0x75")];
  /** The army's selection, acting on the site's tile, as the site's card is opened for it. */
  const ON_THE_SITE = { kind: "army", entityId: 201, tile: SITE_TILE } as const;
  const selection = () => useUIStore.getState().mapSelection;
  const selectedArmy = () => useUIStore.getState().entityActions.selectedEntityId;
  /** No card of how the fight went: the Feed tells it (feed-line.test.tsx). */
  const noResult = (host: HTMLElement) => expect(host.textContent).not.toMatch(/Victory|Army lost/);
  const armyPanel = (host: HTMLElement) => host.querySelector('[aria-label="Army details"]');
  const siteCard = (host: HTMLElement) => host.querySelector(`section[aria-label="${siteName(SITE)}"]`);
  const clears = () => battleArrives([1_498, 1_318], [1_100, 0]);

  /**
   * In a HUD, the army selected on the map, then the camp's card opened for it; an attack sent from the card, then
   * `meanwhile` (what the player does while it is on its way), `lands` (what the action did) and its outcome, applied.
   */
  const attackThatLands = async (
    lands: (store: ReturnType<typeof renderCard>["store"]) => void,
    { hud = "desktop", meanwhile = () => {} }: { hud?: "desktop" | "phone"; meanwhile?: () => void } = {},
  ) => {
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    const card = renderCard("beside", hud);
    act(() => useUIStore.getState().selectOnMap({ kind: "army", entityId: 201, tile: "own" }));
    expect(armyPanel(card.host) !== null).toBe(hud === "desktop");
    act(() => useUIStore.getState().selectOnMap(ON_THE_SITE));
    expect(armyPanel(card.host)).toBeNull();
    await act(async () => card.button("Attack")!.click());
    act(meanwhile);
    act(() => lands(card.store));
    await act(async () => apply(APPLIED));
    return card;
  };

  it("keeps the site's card when both sides stand, its Attack there to press again", async () => {
    const { host, button, unmount } = await attackThatLands(() => battleArrives([1_498, 1_400], [1_100, 600]));
    expect(selection()).toEqual(ON_THE_SITE);
    expect(button("Attack")).toBeDefined();
    noResult(host);
    unmount();
  });

  it("opens the still-selected army's panel again on a desktop after a clear, with no card of the fight", async () => {
    const { host, unmount } = await attackThatLands(clears);
    expect(selectedArmy()).toBe(201);
    expect(armyPanel(host)).not.toBeNull();
    expect(siteCard(host)).toBeNull();
    noResult(host);
    unmount();
  });

  it("gives a phone back its army after a clear: selected on its own tile for the action row, no panel over the map", async () => {
    const { host, unmount } = await attackThatLands(clears, { hud: "phone" });
    expect(selection()).toEqual({ kind: "army", entityId: 201, tile: "own" });
    expect(armyPanel(host)).toBeNull();
    expect(siteCard(host)).toBeNull();
    noResult(host);
    unmount();
  });

  it("keeps the player's newer choice when the clear lands after they let go of the army", async () => {
    const { host, unmount } = await attackThatLands(clears, {
      meanwhile: () => useUIStore.getState().selectOnMap(null),
    });
    expect(selection()).toBeNull();
    expect(armyPanel(host)).toBeNull();
    unmount();
  });

  it("keeps the player's newer choice when the clear lands after they picked another army", async () => {
    const other = { kind: "army", entityId: 202, tile: "own" } as const;
    const { host, unmount } = await attackThatLands(clears, {
      meanwhile: () => useUIStore.getState().selectOnMap(other),
    });
    expect(selection()).toEqual(other);
    expect(armyPanel(host)).toBeNull();
    unmount();
  });

  it("keeps the player's newer choice when the clear lands after they picked another tile for the army", async () => {
    const elsewhere = { kind: "army", entityId: 201, tile: { col: SITE_TILE.col + 2, row: SITE_TILE.row } } as const;
    const { unmount } = await attackThatLands(clears, {
      meanwhile: () => useUIStore.getState().selectOnMap(elsewhere),
    });
    expect(selection()).toEqual(elsewhere);
    unmount();
  });

  it("hands it back on a clear whose battle record has not reached the screen, the site standing cleared", async () => {
    const { host, unmount } = await attackThatLands((store) =>
      store.applyFacts([
        {
          model: "ExpeditionSite",
          key: "0x72",
          value: {
            ...store.require("ExpeditionSite", { game_id: 1, entity_id: SITE }),
            clear: { explorer_id: 201, home_id: 7, reward: null },
          },
        },
      ] as never),
    );
    expect(selectedArmy()).toBe(201);
    expect(armyPanel(host)).not.toBeNull();
    unmount();
  });

  it("shows no card of a lost army: the map lets the army go itself, and the Feed says it was lost", async () => {
    const { host, unmount } = await attackThatLands((store) => {
      battleArrives([1_498, 0], [1_100, 1_028]);
      store.applyFacts(ARMY_GONE as never);
    });
    expect(selection()).toEqual(ON_THE_SITE);
    noResult(host);
    unmount();
  });

  it("changes nothing for an attack the game refused, whatever happens to either side afterwards", async () => {
    waitForAction.mockResolvedValue({ hash: "0x1", block: 9, status: "REVERTED", revertReason: "Army is resting" });
    const { host, store, button, unmount } = renderCard("beside");
    act(() => useUIStore.getState().selectOnMap(ON_THE_SITE));
    await act(async () => button("Attack")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Army is resting");
    act(() => store.applyFacts([...ARMY_GONE, gone("Guard", "0x73")] as never));
    expect(selection()).toEqual(ON_THE_SITE);
    noResult(host);
    unmount();
  });
});

describe("an army picked from a site's card", () => {
  it("asks the map for that army and names the site's tile, so the card stays open with the army as its actor", () => {
    const { host, unmount } = renderCard("beside");
    const asked: unknown[] = [];
    // The site's place as the map reads it: the tile's contract hex, carried as a Position.
    const hear = () => {
      const request = takeArmySelectRequest();
      const site = request?.forSite?.getContract();
      asked.push({ entityId: request?.entityId, forSite: site && { col: site.x, row: site.y } });
    };
    window.addEventListener(ARMY_SELECT_REQUEST_EVENT, hear);
    const rows = [...host.querySelectorAll<HTMLButtonElement>(".ui-row__choose")].filter((row) =>
      row.textContent?.startsWith("Army"),
    );
    expect(rows.length).toBeGreaterThan(0);
    act(() => rows[0].click());
    window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, hear);
    expect(asked).toEqual([{ entityId: 201, forSite: { col: SITE_TILE.col, row: SITE_TILE.row } }]);
    unmount();
  });
});
