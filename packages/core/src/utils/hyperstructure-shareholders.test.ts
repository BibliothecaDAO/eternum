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

  it("rejects malformed tuples with a domain-specific error", () => {
    expect(() => decodeHyperstructureShares([["0xa"]])).toThrow(
      "Hyperstructure shareholder tuple must contain address and basis points",
    );
  });
});
