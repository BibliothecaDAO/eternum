import { describe, expect, it } from "vitest";

import { buildFactoryConfigCalldataParts } from "@/ui/features/factory/shared/factory-config-calldata";
import type { FactoryConfigManifest } from "@/ui/features/factory/shared/factory-metadata";

import { generateFactoryCalldata } from "./factory-config";

const TEST_MANIFEST: FactoryConfigManifest = {
  world: {
    class_hash: "0xworld",
  },
  contracts: [
    {
      class_hash: "0xcontract",
      tag: "s1_eternum-prize_distribution_systems",
      selector: "0xselector",
      init_calldata: [],
    },
  ],
  models: [{ class_hash: "0xmodel" }],
  events: [{ class_hash: "0xevent" }],
  libraries: [],
};

describe("generateFactoryCalldata", () => {
  it("delegates to the shared factory-config calldata builder", () => {
    const expected = buildFactoryConfigCalldataParts(TEST_MANIFEST, "180", "s1_eternum", true);

    expect(generateFactoryCalldata(TEST_MANIFEST, "180", "s1_eternum", true)).toEqual(expected);
  });
});
