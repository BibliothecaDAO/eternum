import { describe, expect, it } from "vitest";

import { resolveCommittedStaminaTextValue } from "./army-stamina-display";

describe("army stamina display", () => {
  it("uses committed stamina for numeric text even when projected stamina is higher", () => {
    expect(
      resolveCommittedStaminaTextValue({
        stamina: { amount: 88n, updated_tick: 5n },
        projectedCurrent: 90,
      }),
    ).toBe(88);
  });
});
