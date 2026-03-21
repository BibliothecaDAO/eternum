import { describe, expect, it } from "vitest";

import { buildFactoryConfigMulticall } from "./factory-config-multicall";
import type { FactoryDeveloperConfigSection } from "./types";

const TEST_SECTIONS: FactoryDeveloperConfigSection[] = [
  {
    id: "libraries",
    label: "Libraries",
    entrypoint: "set_factory_config_libraries",
    description: "Libraries",
    itemCount: 1,
    calldata: ["libraries"],
  },
  {
    id: "contracts",
    label: "Contracts",
    entrypoint: "set_factory_config_contracts",
    description: "Contracts",
    itemCount: 1,
    calldata: ["contracts"],
  },
  {
    id: "base",
    label: "Base",
    entrypoint: "set_factory_config",
    description: "Base",
    calldata: ["base"],
  },
  {
    id: "models",
    label: "Models",
    entrypoint: "set_factory_config_models",
    description: "Models",
    itemCount: 1,
    calldata: ["models"],
  },
];

describe("buildFactoryConfigMulticall", () => {
  it("preserves the fixed set_factory call order", () => {
    const multicall = buildFactoryConfigMulticall({
      factoryAddress: "0xfactory",
      sections: TEST_SECTIONS,
      selectedSectionIds: ["libraries", "base", "models"],
    });

    expect(multicall).toEqual([
      {
        contractAddress: "0xfactory",
        entrypoint: "set_factory_config",
        calldata: ["base"],
      },
      {
        contractAddress: "0xfactory",
        entrypoint: "set_factory_config_models",
        calldata: ["models"],
      },
      {
        contractAddress: "0xfactory",
        entrypoint: "set_factory_config_libraries",
        calldata: ["libraries"],
      },
    ]);
  });
});
