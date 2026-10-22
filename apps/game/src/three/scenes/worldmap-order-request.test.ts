import { ActionType } from "@bibliothecadao/eternum";
import { describe, expect, it } from "vitest";

import {
  attackConfirmsOnTileCard,
  isTouchHold,
  orderOnTap,
  orderVerbOnHud,
  pinsOrder,
  stepBackOnEscape,
} from "./worldmap-order-request";

const step = (actionType: ActionType) => ({ hex: { col: 0, row: 0 }, actionType });
const tap = (path: ReturnType<typeof step>[] | undefined, site = false, ownSpire = false) =>
  orderOnTap({ path, armySelected: true, site, ownSpire });

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
    expect(tap(undefined, true)).toBe("site-card");
    expect(tap([step(ActionType.Move), step(ActionType.UseSite)], true)).toBe("site-card");
    expect(orderOnTap({ path: undefined, armySelected: false, site: true, ownSpire: false })).toBeNull();
  });

  it("opens its realm's spire for the army wherever it stands, ahead of a move onto the spire's tile", () => {
    expect(tap([step(ActionType.Move), step(ActionType.EnterDepth)], false, true)).toBe("site-card");
    expect(tap([step(ActionType.Move), step(ActionType.Move)], false, true)).toBe("site-card");
    expect(tap(undefined, false, true)).toBe("site-card");
    expect(orderOnTap({ path: undefined, armySelected: false, site: false, ownSpire: true })).toBeNull();
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

describe("a tap on a phone, where the HUD carries the verb (owner, 22 October 2026: mobile direction A)", () => {
  const onPhone = (path: ReturnType<typeof step>[] | undefined, hud: { pinned?: boolean; refused?: boolean } = {}) =>
    orderOnTap({
      path,
      armySelected: true,
      site: false,
      ownSpire: false,
      hud: { pinned: hud.pinned ?? false, refused: hud.refused ?? false },
    });
  const explore = [step(ActionType.Move), step(ActionType.Explore)];

  it("pins the order on the first tap and sends it on the same tile's second", () => {
    expect(onPhone(explore)).toBe("pin");
    expect(onPhone(explore, { pinned: true })).toBe("go");
  });

  it("pins the transfer on the player's own army or holding beside the army, which the action row offers", () => {
    expect(onPhone([step(ActionType.Move), step(ActionType.Help)])).toBe("transfer");
  });

  it("says why on a tile the rules refused, and leaves any other tile its own tap", () => {
    expect(onPhone(undefined, { refused: true })).toBe("why");
    expect(onPhone(undefined)).toBeNull();
  });

  it.each([ActionType.UseSite, ActionType.EnterDepth])(
    "keeps %s on its card even when the phone target is pinned",
    (actionType) => {
      expect(
        orderOnTap({
          path: [step(ActionType.Move), step(actionType)],
          armySelected: true,
          site: actionType === ActionType.UseSite,
          ownSpire: actionType === ActionType.EnterDepth,
          hud: { pinned: true, refused: false },
        }),
      ).toBe("site-card");
    },
  );

  it("still opens the attack's preview on a target, which has its own confirm", () => {
    expect(onPhone([step(ActionType.Move), step(ActionType.Attack)], { pinned: true })).toBe("attack");
  });
});

it("tells a finger's hold from a mouse's right-click", () => {
  const rightClick = (event: object) => event as MouseEvent;
  expect(isTouchHold(rightClick({ type: "contextmenu", pointerType: "touch" }))).toBe(true);
  expect(isTouchHold(rightClick({ type: "contextmenu", pointerType: "mouse" }))).toBe(false);
  // A plain mouse event names no pointer type.
  expect(isTouchHold(rightClick({ type: "contextmenu" }))).toBe(false);
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
