import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import {
  attackConfirmsOnTileCard,
  orderOnTap,
  orderVerbOnHud,
  pinsOrder,
  stepBackOnEscape,
} from "./worldmap-order-request";

const step = (actionType: ActionType) => ({ hex: { col: 0, row: 0 }, actionType });
const tap = (path: ReturnType<typeof step>[] | undefined, standingSite = false) =>
  orderOnTap({ path, armySelected: true, standingSite });

describe("a tap on a tile with an army selected", () => {
  it("pins an order on a tile to explore or move to", () => {
    expect(tap([step(ActionType.Move), step(ActionType.Explore)])).toBe("pin");
    expect(tap([step(ActionType.Move), step(ActionType.Move), step(ActionType.Move)])).toBe("pin");
  });

  it("opens the attack preview on a target in reach, a standing site or any other", () => {
    expect(tap([step(ActionType.Move), step(ActionType.Attack)], true)).toBe("attack");
    expect(tap([step(ActionType.Move), step(ActionType.Attack)])).toBe("attack");
  });

  it("opens a standing site out of reach for the army, so its card can say what the army lacks", () => {
    expect(tap(undefined, true)).toBe("site-out-of-reach");
    expect(orderOnTap({ path: undefined, armySelected: false, standingSite: true })).toBeNull();
  });

  it("counts as an order to a tile only a path that explores or moves there", () => {
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Explore)])).toBe(true);
    expect(pinsOrder([step(ActionType.Move), step(ActionType.Help)])).toBe(false);
    expect(pinsOrder([step(ActionType.Move)])).toBe(false);
  });

  it("keeps the tile's own tap everywhere else: the army's own tile, a help or a spire, no path", () => {
    expect(tap([step(ActionType.Move)])).toBeNull();
    expect(tap([step(ActionType.Move), step(ActionType.Help)])).toBeNull();
    expect(tap([step(ActionType.Move), step(ActionType.SpireTravel)])).toBeNull();
    expect(tap(undefined)).toBeNull();
  });
});

describe("Escape on the world map", () => {
  const frontier = { hudCarriesOrderVerb: true, navigationViewOpen: true };
  const shared = { hudCarriesOrderVerb: false, orderPinned: true };

  it("cancels the pinned order first, then clears the selection, where the HUD carries the verb", () => {
    expect(stepBackOnEscape({ ...frontier, orderPinned: true })).toBe("cancel-order");
    expect(stepBackOnEscape({ ...frontier, orderPinned: false })).toBe("clear-selection");
  });

  it("closes an open navigation view before the selection where the HUD shows those views", () => {
    expect(stepBackOnEscape({ ...shared, navigationViewOpen: true })).toBe("close-view");
    expect(stepBackOnEscape({ ...shared, navigationViewOpen: false })).toBe("clear-selection");
  });
});

describe("where an attack is confirmed", () => {
  const attack = (
    frontier: boolean,
    against: { standingSite?: boolean; targetIsArmy?: boolean; attackerIsArmy?: boolean },
  ) =>
    attackConfirmsOnTileCard({
      frontier,
      standingSite: against.standingSite ?? false,
      attackerIsArmy: against.attackerIsArmy ?? true,
      targetIsArmy: against.targetIsArmy ?? false,
    });

  it("confirms a Frontier army's attack on an army on the tile card, on a desktop as on a phone", () => {
    expect(orderVerbOnHud({ frontier: true, layout: "desktop" })).toBe(false);
    expect(attack(true, { targetIsArmy: true })).toBe(true);
  });

  it("confirms an attack on a standing site on its tile card in every mode", () => {
    expect(attack(true, { standingSite: true })).toBe(true);
    expect(attack(false, { standingSite: true })).toBe(true);
  });

  it("keeps the preview for Blitz's army attacks and for a realm's own guard", () => {
    expect(attack(false, { targetIsArmy: true })).toBe(false);
    expect(attack(true, { targetIsArmy: true, attackerIsArmy: false })).toBe(false);
  });
});

describe("the HUD's order verb", () => {
  it("is Frontier's on a phone only: a desktop and Blitz preview the order under the pointer", () => {
    expect(orderVerbOnHud({ frontier: true, layout: "phone" })).toBe(true);
    expect(orderVerbOnHud({ frontier: true, layout: "desktop" })).toBe(false);
    expect(orderVerbOnHud({ frontier: false, layout: "phone" })).toBe(false);
  });
});
