import { describe, expect, it } from "vitest";

import { sampleTotals } from "./live-sample.mjs";

const item = (region, cls, kind = "text", gold = false) => ({ region, cls, kind, gold, text: "" });

describe("a screen's sample at rest", () => {
  it("counts what is visible, what scrolls, the regions holding something visible and the gold controls", () => {
    expect(
      sampleTotals([
        item("Top", "visible"),
        item("Top", "visible", "control", true),
        item("Realms", "visible", "control"),
        item("Realms", "scroll"),
        item("Log", "scroll", "control", true),
      ]),
    ).toEqual({ visible: 3, scroll: 2, groups: 2, primary: 1 });
  });

  it("counts nothing on an empty screen", () => {
    expect(sampleTotals([])).toEqual({ visible: 0, scroll: 0, groups: 0, primary: 0 });
  });
});
