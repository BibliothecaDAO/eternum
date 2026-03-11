import { describe, expect, it } from "vitest";

import { buildStarknetConnectors, getInjectedConnectorsOptions } from "./starknet-connectors";

describe("starknet connector configuration", () => {
  it("keeps recommended wallet providers enabled", () => {
    const options = getInjectedConnectorsOptions();

    expect(options.includeRecommended).toBe("always");
    expect(options.recommended.map((connector) => connector.id)).toEqual(
      expect.arrayContaining(["argentX", "braavos"]),
    );
  });

  it("includes non-cartridge connectors when cartridge-only mode is disabled", () => {
    const cartridgeConnector = { id: "controller" } as any;
    const externalConnector = { id: "metamask" } as any;

    expect(buildStarknetConnectors(cartridgeConnector, [externalConnector], false)).toEqual([
      cartridgeConnector,
      externalConnector,
    ]);
  });
});
