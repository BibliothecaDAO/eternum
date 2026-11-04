import { Vector3 } from "three";
import { describe, expect, it } from "vitest";

import { diveThroughSpire, type SpireDiveStage } from "./worldmap-spire-dive";

// A flat world: a tile (col, row) is drawn at (col, 0, row); the camera looks from 10 up and 10 back.
const OFFSET = new Vector3(0, 10, 10);
const SPIRE = { col: 5, row: 5 };
const SURFACE = { col: 7, row: 7 };
const ETHEREAL = { col: 7, row: 107 };

/** A stage that records what the dive does, each pose as the point looked at and the camera's distance from it. */
function recordingStage(start: { col: number; row: number }) {
  const at = (hex: { col: number; row: number }) => new Vector3(hex.col, 0, hex.row);
  let position = at(start).add(OFFSET);
  let target = at(start);
  const steps: string[] = [];
  const pose = (verb: string, to: Vector3, from: Vector3) =>
    steps.push(`${verb} ${from.x},${from.z} at ${Math.round(to.distanceTo(from) * 10) / 10}`);
  const stage: SpireDiveStage = {
    pose: () => ({ position: position.clone(), target: target.clone() }),
    fly: async (nextPosition, nextTarget) => {
      pose("fly", nextPosition, nextTarget);
      [position, target] = [nextPosition, nextTarget];
    },
    place: (nextPosition, nextTarget) => {
      pose("place", nextPosition, nextTarget);
      [position, target] = [nextPosition, nextTarget];
    },
    cutTo: async (hex) => {
      steps.push(`cut ${hex.col},${hex.row}`);
      target = at(hex);
      position = target.clone().add(position.clone().sub(target));
    },
    pointOf: at,
    veil: async (opacity, ms) => {
      if (ms > 0) steps.push(`veil ${opacity}`);
    },
    hold: (held) => steps.push(held ? "hold" : "release"),
  };
  return { stage, steps };
}

const DISTANCE = Math.round(OFFSET.length() * 10) / 10;
const INSIDE = Math.round(OFFSET.length() * 0.08 * 10) / 10;

describe("the view through a spire", () => {
  it("going down, flies into the spire, cuts under the veil, and emerges over the arrival", async () => {
    const { stage, steps } = recordingStage(SURFACE);
    await diveThroughSpire(stage, { spire: SPIRE, arrival: ETHEREAL, down: true, reducedMotion: false });
    expect(steps).toEqual([
      "hold",
      `fly 5,5 at ${INSIDE}`,
      "veil 1",
      `place 5,5 at ${DISTANCE}`,
      "release",
      "cut 7,107",
      `place 7,107 at ${INSIDE}`,
      "veil 0",
      `fly 7,107 at ${DISTANCE}`,
    ]);
  });

  it("going up, sinks where it looks, and emerges out of the spire, settling over the arrival", async () => {
    const { stage, steps } = recordingStage(ETHEREAL);
    await diveThroughSpire(stage, { spire: SPIRE, arrival: SURFACE, down: false, reducedMotion: false });
    expect(steps).toEqual([
      "hold",
      `fly 7,107 at ${INSIDE}`,
      "veil 1",
      `place 7,107 at ${DISTANCE}`,
      "release",
      "cut 5,5",
      `place 5,5 at ${INSIDE}`,
      "veil 0",
      `fly 7,7 at ${DISTANCE}`,
    ]);
  });

  it("with reduced motion, only the veil covers the cut", async () => {
    const { stage, steps } = recordingStage(SURFACE);
    await diveThroughSpire(stage, { spire: SPIRE, arrival: ETHEREAL, down: true, reducedMotion: true });
    expect(steps).toEqual(["hold", "veil 1", "cut 7,107", "veil 0", "release"]);
  });
});
