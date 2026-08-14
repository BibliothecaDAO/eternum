import { describe, expect, it } from "vitest";

import { ArmyStaminaReading, pickFresherArmyStaminaReading } from "./army-stamina-source";

describe("pickFresherArmyStaminaReading", () => {
  const reading = (overrides: Partial<ArmyStaminaReading>): ArmyStaminaReading => ({
    source: "live",
    updatedTick: 0,
    ...overrides,
  });

  it("prefers the higher updated tick regardless of source", () => {
    const live = reading({ source: "live", updatedTick: 5 });
    const pending = reading({ source: "pending", updatedTick: 4 });

    expect(pickFresherArmyStaminaReading(live, pending)).toBe(live);
    expect(pickFresherArmyStaminaReading(pending, live)).toBe(live);
  });

  it("breaks updated-tick ties in favor of valid pending state over live RECS", () => {
    const pending = reading({ source: "pending", updatedTick: 7 });
    const live = reading({ source: "live", updatedTick: 7 });

    expect(pickFresherArmyStaminaReading(live, pending)).toBe(pending);
    expect(pickFresherArmyStaminaReading(pending, live)).toBe(pending);
  });

  it("preserves the left reading when source and tick are identical", () => {
    const left = reading({ updatedTick: 3 });
    const right = reading({ updatedTick: 3 });
    expect(pickFresherArmyStaminaReading(left, right)).toBe(left);
  });
});
