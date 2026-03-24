import { describe, expect, it } from "vitest";

import { resolveMapHexToggleCooldownDecision } from "./navigation-toggle-policy";

describe("resolveMapHexToggleCooldownDecision", () => {
  it("blocks re-entry while cooldown is active", () => {
    const decision = resolveMapHexToggleCooldownDecision({
      nowMs: 1_000,
      cooldownUntilMs: 1_200,
      cooldownMs: 400,
    });

    expect(decision).toEqual({
      shouldBlockToggle: true,
      nextCooldownUntilMs: 1_200,
    });
  });

  it("arms a new cooldown when toggle is allowed", () => {
    const decision = resolveMapHexToggleCooldownDecision({
      nowMs: 1_000,
      cooldownUntilMs: 900,
      cooldownMs: 400,
    });

    expect(decision).toEqual({
      shouldBlockToggle: false,
      nextCooldownUntilMs: 1_400,
    });
  });

  it("treats negative cooldown input as zero", () => {
    const decision = resolveMapHexToggleCooldownDecision({
      nowMs: 1_000,
      cooldownUntilMs: 900,
      cooldownMs: -1,
    });

    expect(decision).toEqual({
      shouldBlockToggle: false,
      nextCooldownUntilMs: 1_000,
    });
  });
});
