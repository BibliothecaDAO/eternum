import { describe, expect, it } from "vitest";

import { resolveTouchTapIntent } from "./touch-order-policy";

describe("resolveTouchTapIntent", () => {
  it("selects for mouse input regardless of action state", () => {
    expect(
      resolveTouchTapIntent({ isTouch: false, isActionTarget: true, armedHexKey: "1,1", tappedHexKey: "1,1" }),
    ).toBe("select");
  });

  it("selects when the tapped hex is not an action target", () => {
    expect(
      resolveTouchTapIntent({ isTouch: true, isActionTarget: false, armedHexKey: null, tappedHexKey: "1,1" }),
    ).toBe("select");
  });

  it("selects when nothing was tapped", () => {
    expect(resolveTouchTapIntent({ isTouch: true, isActionTarget: true, armedHexKey: "1,1", tappedHexKey: null })).toBe(
      "select",
    );
  });

  it("arms the first touch on an action target", () => {
    expect(resolveTouchTapIntent({ isTouch: true, isActionTarget: true, armedHexKey: null, tappedHexKey: "1,1" })).toBe(
      "arm",
    );
  });

  it("re-arms when a different action target is tapped", () => {
    expect(
      resolveTouchTapIntent({ isTouch: true, isActionTarget: true, armedHexKey: "1,1", tappedHexKey: "2,2" }),
    ).toBe("arm");
  });

  it("commits when the armed hex is tapped again", () => {
    expect(
      resolveTouchTapIntent({ isTouch: true, isActionTarget: true, armedHexKey: "1,1", tappedHexKey: "1,1" }),
    ).toBe("commit");
  });
});
