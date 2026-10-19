// @vitest-environment jsdom
import { Position } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it } from "vitest";

import { ARMY_SELECT_REQUEST_EVENT, requestArmySelection, takeArmySelectRequest } from "./worldmap-army-select-request";

/** A site's place, as the HUD names it: a Position, in the space it was read in. */
const SITE = Position.fromContract({ x: 40, y: 12 });
const taken: Array<ReturnType<typeof takeArmySelectRequest>> = [];
const shownMap = () => taken.push(takeArmySelectRequest());

afterEach(() => {
  window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, shownMap);
  taken.length = 0;
  takeArmySelectRequest();
});

describe("the HUD's request to select an army", () => {
  it("names the army, and the site whose card stays open when it is asked from that card", () => {
    window.addEventListener(ARMY_SELECT_REQUEST_EVENT, shownMap);
    requestArmySelection(201);
    requestArmySelection(202, SITE);
    expect(taken).toEqual([
      { entityId: 201, forSite: null },
      { entityId: 202, forSite: SITE },
    ]);
  });

  it("waits for a map that is not shown yet, which takes the latest request once, when shown", () => {
    requestArmySelection(201);
    requestArmySelection(202, SITE);
    expect(takeArmySelectRequest()).toEqual({ entityId: 202, forSite: SITE });
    expect(takeArmySelectRequest()).toBeNull();
  });
});
