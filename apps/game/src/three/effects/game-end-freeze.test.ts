import { afterEach, expect, it } from "vitest";
import type NodeFrame from "three/src/nodes/core/NodeFrame.js";
import { mapAnimationTime, updateGameEndFreeze } from "./game-end-freeze";

afterEach(() => updateGameEndFreeze(0, false, 0));

it("holds the shader clock after game end and resumes for a new live game", () => {
  updateGameEndFreeze(1, false, 0.1);
  mapAnimationTime.update({ time: 12 } as NodeFrame);
  expect(mapAnimationTime.value).toBe(12);
  updateGameEndFreeze(1, true, 0.1);
  mapAnimationTime.update({ time: 20 } as NodeFrame);
  expect(mapAnimationTime.value).toBe(12);
  updateGameEndFreeze(2, false, 0.1);
  mapAnimationTime.update({ time: 21 } as NodeFrame);
  expect(mapAnimationTime.value).toBe(21);
});
