import { describe, expect, it } from "vitest";

import { describeHyperstructureHold, type VictoryPointGrants } from "./victory-point-grants";

/** Blitz's grants: 5 a tile, 250 a crate or camp, 1,000 a hyperstructure taken, 1 VP a second held. */
const blitz: VictoryPointGrants = {
  exploreTile: 5,
  openRelicCrate: 250,
  claimCampFromBandits: 250,
  claimHyperstructureFromBandits: 1_000,
  hyperstructurePerSecond: 1,
  hyperstructureScale: "per-realm",
};

describe("what a held hyperstructure earns", () => {
  it("is its rate a second for each realm around it where the multiplier counts realms (Blitz)", () => {
    expect(describeHyperstructureHold(blitz)).toEqual({
      grant: "1 VP/s × realms",
      rule: "Hold a Hyperstructure: 1 VP every second for each realm settled on the six sites around it",
    });
  });

  it("is its rate a second where no multiplier applies", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "flat" }).grant).toBe("1 VP/s");
  });

  it("is twice its rate a second in a Duel", () => {
    expect(describeHyperstructureHold({ ...blitz, hyperstructureScale: "double" }).grant).toBe("2 VP/s");
  });
});
