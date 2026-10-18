import { expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/eternum", () => ({ configManager: {} }));

import { goalLine, goalSentence } from "./points-goal";

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

it("says the goal and what scores in one sentence, from the game's grants", () => {
  expect(goalSentence(3600, BLITZ_GRANTS)).toBe(
    "Most points in 1h wins: explore (+5 a tile), open crates (+250), take camps and rifts (+250) and " +
      "Hyperstructures (+1,000, then points every second).",
  );
});
