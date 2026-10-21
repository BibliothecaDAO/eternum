import { expect, it } from "vitest";

import { STUDIO_PLACES } from "./fixture";
import { STUDIO_TRIGGERS } from "./stage";
import { STUDIO_TAKES } from "./takes";

const places = {
  realm: [1, 0, 1],
  hyperstructure: [9, 0, 2],
  attacker: [5, 0, 8],
  defender: [6, 0, 8],
  exploreStart: [0, 0, 7],
} satisfies Record<string, [number, number, number]>;

it.each(Object.entries(STUDIO_TAKES))(
  "the %s take cues only moments the studio plays, from a whole first pose",
  (_, take) => {
    const path = take.path(places);
    for (const cue of path.cues ?? []) expect(STUDIO_TRIGGERS).toContain(cue.trigger);
    expect(path.keys[0]).toMatchObject({ t: 0, distance: expect.any(Number), tilt: expect.any(Number) });
  },
);

it("explores as many hexes as the explorer's route holds", () => {
  const explores = STUDIO_TAKES.explore.path(places).cues.filter((cue) => cue.trigger === "explore");
  expect(explores).toHaveLength(STUDIO_PLACES.exploreRoute.length);
});

it("walks the explorer one hex at a time, each into the row south of the last", () => {
  let from = STUDIO_PLACES.exploreStart;
  for (const hex of STUDIO_PLACES.exploreRoute) {
    expect(hex.row).toBe(from.row + 1);
    expect(Math.abs(hex.col - from.col)).toBeLessThanOrEqual(1);
    from = hex;
  }
});
