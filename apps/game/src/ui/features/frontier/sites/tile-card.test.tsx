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
import { armyOrderInFlight, orderArmy } from "@/hooks/store/use-army-orders-in-flight";
import { useUIStore } from "@/hooks/store/use-ui-store";
import { ActionPaths, ActionType, setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import type { TileSpatialRenderable } from "@bibliothecadao/eternum/game-sync";
import { campBeside, otherArmyAt, SITE, SITE_TILE } from "./site-fixture";
import { TileCard } from "./tile-card";

const APPLIED = { hash: "0x1", block: 9, status: "SUCCEEDED" };

beforeEach(() => {
  waitForAction.mockReset();
  waitForAction.mockResolvedValue(APPLIED);
});

afterEach(() => {
  setBlockTimestampSource(null);
  useUIStore.getState().updateEntityActionSelectedEntityId(null);
  useUIStore.getState().updateEntityActionActionPaths(new Map());
});

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
      </GameProvider>,
    ),
  );
  const button = (word: string) =>
    [...host.querySelectorAll("button")].find((candidate) => candidate.textContent?.includes(word));
  const unmount = () => {
    act(() => root.unmount());
    host.remove();
  };
  return { host, attack, button, unmount };
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
    expect(armyOrderInFlight(201)).toBe("attack");
    // The send returned long ago; only the outcome ends the wait.
    await act(async () => {});
    expect(button("Attacking…")?.disabled).toBe(true);
    await settle(APPLIED);
    expect(armyOrderInFlight(201)).toBeUndefined();
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
    expect(armyOrderInFlight(201)).toBeUndefined();
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
    let moved: Promise<boolean> = Promise.resolve(false);
    act(() => void (moved = orderArmy(201, "move", () => Promise.resolve({ transaction_hash: "0x2" }))));
    expect(button("On its way…")?.disabled).toBe(true);
    await act(async () => button("On its way…")!.click());
    expect(attack).not.toHaveBeenCalled();
    await settle(APPLIED);
    expect(await moved).toBe(true);
    expect(button("Attack")?.disabled).toBe(false);
    unmount();
  });
});
