import { describe, expect, it } from "vitest";

import { resolveDisplayedStaminaValue } from "./army-stamina-display";

describe("army stamina display", () => {
  it("uses projected stamina for numeric text when the projected bar is ahead", () => {
    expect(
      resolveDisplayedStaminaValue({
        stamina: { amount: 88n, updated_tick: 5n },
        projectedCurrent: 90,
      }),
    ).toBe(90);
  });

  it("falls back to committed stamina when projected stamina is unavailable", () => {
    expect(
      resolveDisplayedStaminaValue({
        stamina: { amount: 88n, updated_tick: 5n },
      }),
    ).toBe(88);
  });
});
