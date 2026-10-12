// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { ARMY_SELECT_REQUEST_EVENT, readArmySelectRequest, requestArmySelection } from "./worldmap-army-select-request";

const heard: Array<ReturnType<typeof readArmySelectRequest>> = [];
const listen = (event: Event) => heard.push(readArmySelectRequest(event));

afterEach(() => {
  window.removeEventListener(ARMY_SELECT_REQUEST_EVENT, listen);
  heard.length = 0;
});

describe("the HUD's request to select an army", () => {
  it("names the army, and the site whose card stays open when it is asked from that card", () => {
    window.addEventListener(ARMY_SELECT_REQUEST_EVENT, listen);
    requestArmySelection(201);
    requestArmySelection(202, { col: 40, row: 12 });
    expect(heard).toEqual([
      { entityId: 201, forSite: null },
      { entityId: 202, forSite: { col: 40, row: 12 } },
    ]);
  });

  it("is nothing without an army", () => {
    expect(readArmySelectRequest(new CustomEvent(ARMY_SELECT_REQUEST_EVENT, { detail: {} }))).toBeNull();
  });
});
