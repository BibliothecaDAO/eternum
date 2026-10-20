import { expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/eternum", () => ({ configManager: {} }));

import { goalLine, goalScoring } from "./points-goal";

const BLITZ_GRANTS = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1000,
};

it("puts the goal in one line, with the game's own length, and without one for a game with no set end", () => {
  expect(goalLine(3600)).toBe("Most points in 1h wins");
  expect(goalLine(null)).toBe("Most points wins");
});

it("says the goal and what scores in one compact line, from the game's grants", () => {
  expect(goalScoring(3600, BLITZ_GRANTS)).toBe(
    "Most points in 1h wins · tile +5 · crate +250 · camp or rift +250 · Hyperstructure +1,000, then per second",
  );
  expect(goalScoring(null, { ...BLITZ_GRANTS, exploreTile: 10 })).toBe(
    "Most points wins · tile +10 · crate +250 · camp or rift +250 · Hyperstructure +1,000, then per second",
  );
});
