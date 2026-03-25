import { describe, expect, it } from "vitest";

import { resolveBootstrapManifest } from "../../../src/entry/bootstrap-manifest";

describe("resolveBootstrapManifest", () => {
  it("prefers an explicit manifest override over the embedded chain manifest", () => {
    const override = {
      contracts: [
        {
          tag: "s1_eternum-troop_movement_systems",
          address: "0x123",
        },
      ],
    };

    const manifest = resolveBootstrapManifest({
      chain: "slot",
      worldAddress: "0xabc",
      manifestOverride: override,
    });

    expect(manifest).toBe(override);
  });
});
