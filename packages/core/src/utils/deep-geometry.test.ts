import { describe, expect, it } from "vitest";

import { deepGate } from "./deep-geometry";

describe("the Deep's gates", () => {
  it("stands each Aspect's gate where the contract does: Might, Harmony, Chaos, Guile around the centre", () => {
    expect([1, 2, 3, 4].map((aspect) => deepGate(1024, 4, aspect))).toEqual([
      { col: 512, row: 3588 },
      { col: 516, row: 3584 },
      { col: 512, row: 3580 },
      { col: 508, row: 3584 },
    ]);
  });

  it("refuses an Aspect with no gate", () => {
    expect(() => deepGate(1024, 4, 5)).toThrow("No Deep gate for Aspect 5");
  });
});
