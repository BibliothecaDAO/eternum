import { describe, expect, it } from "vitest";

import { DEFAULT_FACTORY_CONFIG_VERSION } from "../../../../../../../config/shared/factory-defaults";
import { FACTORY_ADDRESSES, resolveFactoryAddress, resolveFactoryConfigDefaultVersion } from "./factory-metadata";

describe("factory metadata", () => {
  it("resolves the default version by mode", () => {
    expect(resolveFactoryConfigDefaultVersion("blitz")).toBe(DEFAULT_FACTORY_CONFIG_VERSION);
    expect(resolveFactoryConfigDefaultVersion("eternum")).toBe(DEFAULT_FACTORY_CONFIG_VERSION);
  });

  it("resolves the factory address by chain", () => {
    expect(resolveFactoryAddress("appchain")).toBe(FACTORY_ADDRESSES.appchain);
    expect(resolveFactoryAddress("madara")).toBe("");
  });
});
