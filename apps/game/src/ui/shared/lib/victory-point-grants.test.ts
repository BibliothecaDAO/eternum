import { describe, expect, it } from "vitest";

import { describeHyperstructureHold, type VictoryPointGrants } from "./victory-point-grants";

/** Blitz's grants: 5 a tile, 250 a crate or camp, 1,000 a hyperstructure taken, 1 points a second held. */
const blitz: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1_000,
  hyperstructurePerSecond: 1,
  hyperstructureScale: "per-realm",
};

describe("what a held hyperstructure earns", () => {
  it("states no one rate where each hyperstructure pays by the realms around it (Blitz), and gives the rule on hover", () => {
    expect(describeHyperstructureHold(blitz)).toEqual({
      grant: "points/second",
      rule: "Hold a Hyperstructure: 1 points every second for each realm settled on the six sites around it",
    });
  });

  it("is its rate a second where no multiplier applies", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "flat" }).grant).toBe("1 points/s");
  });

  it("is twice its rate a second in a Duel", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "double" }).grant).toBe("2 points/s");
  });
});
