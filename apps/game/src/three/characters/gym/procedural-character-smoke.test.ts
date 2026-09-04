import { describe, expect, it } from "vitest";

import {
  advanceCharacterGymSmoke,
  completeCharacterGymSmoke,
  startCharacterGymSmoke,
} from "./procedural-character-smoke";

describe("procedural character gym smoke sequence", () => {
  it("emits each smoke action at an explicit deterministic phase", () => {
    const started = startCharacterGymSmoke();
    const ragdoll = advanceCharacterGymSmoke(started, 2.1);
    const impact = advanceCharacterGymSmoke(ragdoll.state, 0.12);
    const evaluate = advanceCharacterGymSmoke(impact.state, 3.6);
    const completed = completeCharacterGymSmoke(evaluate.state, []);

    expect(ragdoll.actions).toEqual(["start-ragdoll"]);
    expect(impact.actions).toEqual(["apply-impulse"]);
    expect(evaluate.actions).toEqual(["evaluate"]);
    expect(completed.phase).toBe("passed");
  });
});
