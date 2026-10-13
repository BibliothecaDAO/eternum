import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/helpers/use-block-timestamp", () => ({
  useNowSeconds: () => 350,
  useCurrentArmiesTick: () => 3,
  useCurrentDefaultTick: () => 3,
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
import { ARMY_SELECT_REQUEST_EVENT, readArmySelectRequest } from "@/three/scenes/worldmap-army-select-request";
import { inFlight, sendOnce } from "@/hooks/store/use-actions-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActionPaths, ActionType, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { ResourcesIds } from "@bibliothecadao/types";
import { closeFightResult, useFightResult } from "./fight-result";
import { FightResultCard } from "./fight-result-card";
import { campBeside, otherArmyAt, SITE, SITE_TILE } from "./site-fixture";
import { TileCard } from "./tile-card";

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };

beforeEach(() => {
  waitForAction.mockReset();
  waitForAction.mockResolvedValue(APPLIED);
});

afterEach(() => {
  closeFightResult();
  resetGameSyncStoryEvents();
  setBlockTimestampSource(null);
  useUIStore.getState().updateEntityActionSelectedEntityId(null);
  useUIStore.getState().updateEntityActionActionPaths(new Map());
});

/** The fight's result as the HUD's sheet shows it, beside the card that sent the attack. */
const Result = () => {
  const result = useFightResult();
  return result && <FightResultCard result={result} onClose={closeFightResult} />;
};

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

/** The clear's payout, reaching the client in the winning battle's transaction: the reward the contract set. */
const payoutArrives = (reward: { resource_type: number; amount: string } | null) =>
  acceptGameSyncStoryEvent(
    {
      model: "StoryEvent",
      key: `0xpayout${battles}`,
      value: {
        game_id: "0x1",
        owner: "0x111",
        entity_id: SITE,
        story: { SitePayout: { structure_id: 7, explorer_id: 201, site_id: SITE, category: 9, reward } },
        timestamp: 350,
        event_position: { block_number: 9, transaction_hash: "0x1", transaction_index: 0, event_index: battles++ },
      },
    },
    { chainId: "0x1", worldAddress: "0xabc", gameId: 1 },
  );

/** The realm's labor store as a payout leaves it when it could not take all of it: at its own limit. */
const fillLaborStore = (store: ReturnType<typeof campBeside>["store"]) => {
  const limit =
    BigInt(store.require("SliceRules", { game_id: 1 }).troop_limit_config.settlement_deployment_cap) *
    BigInt(store.require("BoardRules", { game_id: 1 }).castle_store_deploys) *
    1_000_000_000n;
  store.applyFacts([
    {
      model: "ResourceBalance",
      key: "0x79",
      value: { game_id: 1, entity_id: 7, resource_type: ResourcesIds.Labor, balance: String(limit) },
    },
  ] as never);
};

/** The card over the fixture's camp, its army beside it or moved away to stand out of reach. */
const renderCard = (army: "beside" | "far") => {
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
        <TileCard selected={{ kind: "site", site, structure, tile }} onClose={() => {}} />
        <Result />
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
  it("names the guard, offers no Attack until an army is chosen, then attacks with the same tap", async () => {
    const { host, attack, button, unmount } = renderCard("beside");
    expect(host.querySelector('section[aria-label="Camp"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="troops 1,100"]')).not.toBeNull();
    expect(button("Attack")).toBeUndefined();

    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    expect(button("Attack")?.disabled).toBe(false);
    await act(async () => button("Attack")!.click());
    expect(attack).toHaveBeenCalledWith(expect.objectContaining({ explorer_id: 201, structure_id: SITE }));
    unmount();
  });

  it("offers Move by the order that leads beside the site, never by a tile another army of the player holds", () => {
    const { host, button, unmount } = renderCard("far");
    const path = (col: number, row: number, actionType: ActionType) => [
      { hex: { col: 60, row: 12 }, actionType: ActionType.Move },
      { hex: { col, row }, actionType },
    ];
    act(() => {
      useUIStore.getState().updateEntityActionSelectedEntityId(201);
      useUIStore.getState().updateEntityActionActionPaths(
        new Map([
          [ActionPaths.posKey({ col: 41, row: 12 }), path(41, 12, ActionType.Help)],
          [ActionPaths.posKey({ col: 39, row: 12 }), path(39, 12, ActionType.Explore)],
        ]),
      );
    });
    expect(button("Move")?.disabled).toBe(false);
    expect(button("Attack")).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Too far from the Camp");
    unmount();
  });

  it("tells the selected army the site is too far when it stands out of reach with no order leading beside it", () => {
    const { host, button, unmount } = renderCard("far");
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    expect(button("Attack")?.disabled).toBe(true);
    expect(button("Move")).toBeUndefined();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Too far from the Camp");
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
          <TileCard selected={{ kind: "army", army: other, tile }} onClose={() => {}} />
        </GameProvider>,
      ),
    );
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    expect(host.querySelector('section[aria-label="Army"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="troops 300"]')).not.toBeNull();
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
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    return { ...card, settle: (outcome: unknown) => act(async () => settle(outcome)) };
  };

  it("sends one attack for two presses, and reads Attacking… until the action's own outcome arrives", async () => {
    const { attack, button, settle, unmount } = attackInFlight();
    await act(async () => {
      // Both presses land before the card draws again: the second finds the army taken.
      button("Attack")!.click();
      button("Attack")!.click();
    });
    expect(attack).toHaveBeenCalledTimes(1);
    expect(button("Attacking…")?.disabled).toBe(true);
    expect(inFlight("army", 201)).toBe("attack");
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
    const { host, attack, button, settle, unmount } = attackInFlight();
    await act(async () => button("Attack")!.click());
    await settle({ hash: "0x1", block: 9, status: "REJECTED", revertReason: "Not enough stamina" });
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Not enough stamina");
    expect(inFlight("army", 201)).toBeUndefined();
    expect(button("Attack")?.disabled).toBe(false);
    // The next attack takes the line away.
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    await act(async () => button("Attack")!.click());
    expect(attack).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="status"]')).toBeNull();
    await act(async () => apply(APPLIED));
    unmount();
  });

  it("says the same when the attack could not be sent at all", async () => {
    const { host, attack, button, unmount } = attackInFlight();
    attack.mockRejectedValueOnce(new Error("The shard refused the request"));
    await act(async () => button("Attack")!.click());
    expect(waitForAction).not.toHaveBeenCalled();
    expect(host.querySelector('[role="status"]')?.textContent).toBe("The shard refused the request");
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });

  it("holds Attack back while another order of the same army is still on its way", async () => {
    const { attack, button, settle, unmount } = attackInFlight();
    let moved: Promise<string | null> = Promise.resolve(null);
    act(() => void (moved = sendOnce("army", 201, "move", () => Promise.resolve({ transaction_hash: "0x2" }))));
    expect(button("On its way…")?.disabled).toBe(true);
    await act(async () => button("On its way…")!.click());
    expect(attack).not.toHaveBeenCalled();
    await settle(APPLIED);
    expect(await moved).toBe("0x2");
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });
});

describe("the result of the player's attack", () => {
  const gone = (model: string, key: string) => ({ model, key, value: null });
  const ARMY_GONE = [gone("ExplorerTroops", "0x74"), gone("TileOccupancy", "0x75")];
  const SITE_OUT_OF_SCOPE = [gone("Structure", "0x71"), gone("ExpeditionSite", "0x72"), gone("Guard", "0x73")];

  /** An attack sent from the card; `lands` writes what the action did, then its outcome arrives as applied. */
  const attackThatLands = async (lands: (store: ReturnType<typeof renderCard>["store"]) => void) => {
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    const card = renderCard("beside");
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    await act(async () => card.button("Attack")!.click());
    act(() => lands(card.store));
    await act(async () => apply(APPLIED));
    const result = () => card.host.querySelector<HTMLButtonElement>("button[aria-label^='Camp:']");
    return { ...card, result };
  };

  it("is the army's loss, with the guard as the battle left it, when the army falls and its site is still known", async () => {
    const { result, unmount } = await attackThatLands((store) => {
      battleArrives([1_498, 0], [1_100, 1_028]);
      store.applyFacts(ARMY_GONE as never);
    });
    expect(result()?.getAttribute("aria-label")).toBe("Camp: Army lost");
    expect(result()!.querySelector('[aria-label="Army 1,498 → 0"]')).not.toBeNull();
    expect(result()!.querySelector('[aria-label="troops 1,100 → 1,028"]')).not.toBeNull();
    unmount();
  });

  it("is still the army's loss, and pays nothing, when the army's death takes its region out of the store in the same write", async () => {
    const { result, unmount } = await attackThatLands((store) => {
      battleArrives([1_498, 0], [1_100, 1_028]);
      store.applyFacts([...ARMY_GONE, ...SITE_OUT_OF_SCOPE] as never);
    });
    expect(result()?.getAttribute("aria-label")).toBe("Camp: Army lost");
    expect(result()!.querySelector('[aria-label="troops 1,100 → 1,028"]')).not.toBeNull();
    expect(result()!.textContent).not.toContain("+550");
    expect(result()!.querySelector('[aria-label^="XP"]')).toBeNull();
    unmount();
  });

  it("says only that the army was lost when the region left and no record of the battle arrived", async () => {
    const { result, unmount } = await attackThatLands((store) =>
      store.applyFacts([...ARMY_GONE, ...SITE_OUT_OF_SCOPE] as never),
    );
    expect(result()?.getAttribute("aria-label")).toBe("Camp: Army lost");
    expect(result()!.querySelector('[aria-label="Army 1,498 → 0"]')).not.toBeNull();
    expect(result()!.querySelector('[aria-label^="troops"]')).toBeNull();
    expect(result()!.textContent).not.toContain("+");
    unmount();
  });

  it("claims nothing when the site's rows are gone, the army stands and no record of the battle arrived", async () => {
    const { result, unmount } = await attackThatLands((store) => store.applyFacts(SITE_OUT_OF_SCOPE as never));
    expect(result()).toBeNull();
    unmount();
  });

  it("is a victory only on the record of an army that stands over a fallen guard, paying what the payout record names", async () => {
    const { result, unmount } = await attackThatLands(() => {
      battleArrives([1_498, 1_318], [1_100, 0]);
      // The card's preview said 550 labor; the record of what the contract paid says 700, and the card says that.
      payoutArrives({ resource_type: ResourcesIds.Labor, amount: whole(700) });
    });
    expect(result()?.getAttribute("aria-label")).toBe("Camp: Victory");
    expect(result()!.querySelector('[aria-label="Army 1,498 → 1,318"]')).not.toBeNull();
    expect(result()!.textContent).toContain("+700");
    expect(result()!.textContent).not.toContain("550");
    expect(result()!.querySelector('[aria-label^="XP +"]')).not.toBeNull();
    expect(result()!.querySelector('[aria-label="Store Full"]')).toBeNull();
    unmount();
  });

  it("marks the reward Full when the store that took it stands at its limit after the fight", async () => {
    const { result, unmount } = await attackThatLands((store) => {
      battleArrives([1_498, 1_318], [1_100, 0]);
      payoutArrives({ resource_type: ResourcesIds.Labor, amount: whole(550) });
      fillLaborStore(store);
    });
    expect(result()!.textContent).toContain("+550");
    expect(result()!.querySelector('[aria-label="Store Full"]')?.getAttribute("data-tip")).toBe(
      "The store is full: the rest did not fit",
    );
    unmount();
  });

  it("shows a victory's XP alone when no payout record of the clear arrived", async () => {
    const { result, unmount } = await attackThatLands(() => battleArrives([1_498, 1_318], [1_100, 0]));
    expect(result()?.getAttribute("aria-label")).toBe("Camp: Victory");
    expect(result()!.querySelector('[aria-label^="XP +"]')).not.toBeNull();
    expect(result()!.textContent).not.toContain("550");
    unmount();
  });

  it("reports no fight for an attack the game refused, whatever happens to either side afterwards", async () => {
    waitForAction.mockResolvedValue({ hash: "0x1", block: 9, status: "REVERTED", revertReason: "Army is resting" });
    const { host, store, button, unmount } = renderCard("beside");
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    await act(async () => button("Attack")!.click());
    expect(host.querySelector('[role="status"]')?.textContent).toBe("Army is resting");
    // The army ends its day, and the site's guard changes: neither is this attack's doing.
    act(() => store.applyFacts([...ARMY_GONE, gone("Guard", "0x73")] as never));
    expect(host.querySelector("button[aria-label^='Camp:']")).toBeNull();
    unmount();
  });
});

describe("an attack on another player's army", () => {
  it("is the army's loss when mine falls and its region leaves the store, never a victory over rows that are gone", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const { store } = campBeside();
    const other = otherArmyAt(store, 42, 12);
    useAccountStore.setState({ account: { address: "0x111" } as never });
    let apply: (outcome: unknown) => void = () => {};
    waitForAction.mockReturnValue(new Promise((resolve) => (apply = resolve)));
    const attack = vi.fn(() => Promise.resolve({ transaction_hash: "0x1" }));
    const tile = { hexCoords: { col: 42, row: 12, alt: false }, biome: 11, occupierId: 301 };
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() =>
      root.render(
        <GameProvider
          value={{ store, systemCalls: { attack_explorer_vs_explorer: attack } } as unknown as GameClientSetup}
          account={{ address: "0x111" } as never}
        >
          <TileCard
            selected={{ kind: "army", army: other, tile: tile as unknown as TileSpatialRenderable }}
            onClose={() => {}}
          />
          <Result />
        </GameProvider>,
      ),
    );
    act(() => useUIStore.getState().updateEntityActionSelectedEntityId(201));
    await act(async () =>
      [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes("Attack"))!.click(),
    );
    act(() => {
      battleArrives([1_498, 0], [300, 120], 301);
      store.applyFacts([
        { model: "ExplorerTroops", key: "0x74", value: null },
        { model: "TileOccupancy", key: "0x75", value: null },
        { model: "ExplorerTroops", key: "0x90", value: null },
      ] as never);
    });
    await act(async () => apply(APPLIED));
    const result = host.querySelector("button[aria-label^='Army:']")!;
    expect(result.getAttribute("aria-label")).toBe("Army: Army lost");
    expect(result.querySelector('[aria-label="troops 300 → 120"]')).not.toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});

describe("an army picked from a site's card", () => {
  it("asks the map for that army and names the site's tile, so the card stays open with the army as its actor", () => {
    const { host, unmount } = renderCard("beside");
    const asked: unknown[] = [];
    const hear = (event: Event) => asked.push(readArmySelectRequest(event));
    window.addEventListener(ARMY_SELECT_REQUEST_EVENT, hear);
    const rows = [...host.querySelectorAll<HTMLButtonElement>("button[aria-label^='Army']")];
    expect(rows.length).toBeGreaterThan(0);
    act(() => rows[0].click());
    window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, hear);
    expect(asked).toEqual([{ entityId: 201, forSite: { col: SITE_TILE.col, row: SITE_TILE.row } }]);
    unmount();
  });
});
