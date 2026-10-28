// @vitest-environment jsdom
import { Position } from "@bibliothecadao/eternum";
import { afterEach, describe, expect, it } from "vitest";

import {
  ARMY_SELECT_REQUEST_EVENT,
  requestArmyForSite,
  requestArmyShown,
  takeArmySelectRequest,
} from "./worldmap-army-select-request";

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
  it("names the army, the site whose card stays open, and whether the player asked to see it or picked an actor", () => {
    window.addEventListener(ARMY_SELECT_REQUEST_EVENT, shownMap);
    requestArmyShown(201);
    requestArmyShown(202, SITE);
    requestArmyForSite(203, SITE);
    expect(taken).toEqual([
      { entityId: 201, forSite: null, look: true },
      { entityId: 202, forSite: SITE, look: true },
      { entityId: 203, forSite: SITE, look: false },
    ]);
  });

  it("waits for a map that is not shown yet, which takes the latest request once, when shown", () => {
    requestArmyShown(201);
    requestArmyForSite(202, SITE);
    expect(takeArmySelectRequest()).toEqual({ entityId: 202, forSite: SITE, look: false });
    expect(takeArmySelectRequest()).toBeNull();
  });
});
