import { describe, expect, it } from "vitest";

import { resolveArmyStaminaTickRefresh } from "./army-stamina-tick-policy";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ArmyManager chain-time updates", () => {
  it("recomputes stamina only when the armies tick advances", () => {
    expect(resolveArmyStaminaTickRefresh({ currentTick: 5, previousTick: 5 })).toEqual({
      nextTrackedTick: 5,
      shouldRecompute: false,
    });
    expect(resolveArmyStaminaTickRefresh({ currentTick: 6, previousTick: 5 })).toEqual({
      nextTrackedTick: 6,
      shouldRecompute: true,
    });
  });

  it("subscribes to shared chain time instead of owning a timer loop", () => {
    const source = readFileSync(resolve(process.cwd(), "src/three/managers/army-manager.ts"), "utf8");

    expect(source).toContain("useChainTimeStore.subscribe");
    expect(source).toContain("this.recomputeStaminaForAllArmies(currentArmiesTick)");
    expect(source).not.toContain("useBlockTimestampStore");
    expect(source).toContain("this.unsubscribeChainTime?.()");
    expect(source).not.toContain("scheduleTickCheck");
    expect(source).not.toContain("tickCheckTimeout");
  });
});
