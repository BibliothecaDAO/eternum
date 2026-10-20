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
      grant: "x/s",
      rule:
        "Hold a Hyperstructure: 1 point every second for each realm settled on the six sites around it, split by " +
        "share among its holders; a realm settled later counts from its next capture or share allocation",
    });
  });

  it("is its rate a second where no multiplier applies, split among its holders", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "flat" })).toEqual({
      grant: "+1/s",
      rule: "Hold a Hyperstructure: 1 point every second, split by share among its holders",
    });
  });

  it("is twice its rate a second in a Duel, split among its holders", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "double" })).toEqual({
      grant: "+2/s",
      rule: "Hold a Hyperstructure: 2 points every second, split by share among its holders",
    });
  });
});
