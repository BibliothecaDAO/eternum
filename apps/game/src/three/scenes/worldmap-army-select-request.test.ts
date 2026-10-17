// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { ARMY_SELECT_REQUEST_EVENT, requestArmySelection, takeArmySelectRequest } from "./worldmap-army-select-request";

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
    requestArmySelection(202, { col: 40, row: 12 });
    expect(taken).toEqual([
      { entityId: 201, forSite: null },
      { entityId: 202, forSite: { col: 40, row: 12 } },
    ]);
  });

  it("waits for a map that is not shown yet, which takes the latest request once, when shown", () => {
    requestArmySelection(201);
    requestArmySelection(202, { col: 40, row: 12 });
    expect(takeArmySelectRequest()).toEqual({ entityId: 202, forSite: { col: 40, row: 12 } });
    expect(takeArmySelectRequest()).toBeNull();
  });
});
