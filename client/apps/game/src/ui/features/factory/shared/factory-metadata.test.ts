import { describe, expect, it } from "vitest";

import { FACTORY_ADDRESSES, resolveFactoryAddress, resolveFactoryConfigDefaultVersion } from "./factory-metadata";

describe("factory metadata", () => {
  it("resolves the default version by mode", () => {
    expect(resolveFactoryConfigDefaultVersion("blitz")).toBe("180");
    expect(resolveFactoryConfigDefaultVersion("eternum")).toBe("180");
  });

  it("resolves the factory address by chain", () => {
    expect(resolveFactoryAddress("slot")).toBe(FACTORY_ADDRESSES.slot);
    expect(resolveFactoryAddress("mainnet")).toBe(FACTORY_ADDRESSES.mainnet);
  });
});
