import { AnimationClip } from "three";
import { describe, expect, it } from "vitest";

import { findAnimationByName } from "../animation-clip-matcher";

function clip(name: string): AnimationClip {
  return { name } as AnimationClip;
}

describe("findAnimationByName", () => {
  it("matches case-insensitively", () => {
    const result = findAnimationByName([clip("Knight_IDLE")], ["idle"]);
    expect(result?.name).toBe("Knight_IDLE");
  });

  it("uses token boundaries to avoid false positives like die in soldier", () => {
    const result = findAnimationByName([clip("soldier_idle"), clip("knight_die")], ["die", "death"]);
    expect(result?.name).toBe("knight_die");
  });

  it("supports prefix matches on token boundaries", () => {
    const result = findAnimationByName([clip("standing_loop")], ["stand"]);
    expect(result?.name).toBe("standing_loop");
  });
});
