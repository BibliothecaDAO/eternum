import { describe, expect, it } from "vitest";

import { decodeHyperstructureShares } from "./hyperstructure-shareholders";

describe("decodeHyperstructureShares", () => {
  it("decodes tuple arrays stored in RECS", () => {
    expect(
      decodeHyperstructureShares([
        ["0xa", "0x1388"],
        ["0xb", 2_500],
      ]),
    ).toEqual([
      { playerAddress: 10n, basisPoints: 5_000n },
      { playerAddress: 11n, basisPoints: 2_500n },
    ]);
  });

  it("decodes the numeric-key tuple records Herald streams", () => {
    expect(decodeHyperstructureShares([{ "0": "0xa", "1": "0x2710" }])).toEqual([
      { playerAddress: 10n, basisPoints: 10_000n },
    ]);
  });

  it("rejects malformed tuples with a domain-specific error", () => {
    for (const malformed of [[["0xa"]], [{ "0": "0xa" }], [{ address: "0xa", bps: 1 }]]) {
      expect(() => decodeHyperstructureShares(malformed)).toThrow(
        "Hyperstructure shareholder tuple must contain address and basis points",
      );
    }
  });
});
