import { describe, expect, it } from "vitest";

import { buildFactoryConfigCalldataParts } from "./factory-config-calldata";
import type { FactoryConfigManifest } from "./factory-metadata";

const TEST_MANIFEST: FactoryConfigManifest = {
  world: {
    class_hash: "0xworld",
  },
  contracts: [
    {
      class_hash: "0xcontract",
      tag: "s1_eternum-prize_distribution_systems",
      selector: "0xselector",
      init_calldata: ["0x1", "0x2"],
    },
  ],
  models: [{ class_hash: "0xmodel" }],
  events: [{ class_hash: "0xevent" }],
  libraries: [
    {
      class_hash: "0xlibrary",
      tag: "s1_eternum-utility_v1",
      version: "1",
    },
  ],
};

describe("buildFactoryConfigCalldataParts", () => {
  it("builds the five set_factory calldata parts from the manifest", () => {
    const parts = buildFactoryConfigCalldataParts(TEST_MANIFEST, "180", "s1_eternum", true);

    expect(parts.base[0]).toBe("180");
    expect(parts.base[1]).toBe("0xworld");
    expect(parts.base[3]).toBe(1);

    expect(parts.contracts).toEqual(["180", 1, "0xselector", "0xcontract", 2, "0x1", "0x2"]);
    expect(parts.models).toEqual(["180", 1, "0xmodel"]);
    expect(parts.events).toEqual(["180", 1, "0xevent"]);
    expect(parts.libraries[0]).toBe("180");
    expect(parts.libraries[1]).toBe(1);
    expect(parts.libraries[2]).toBe("0xlibrary");
    expect(parts.all).toEqual([
      ...parts.base,
      ...parts.contracts,
      ...parts.models,
      ...parts.events,
      ...parts.libraries,
    ]);
  });
});
