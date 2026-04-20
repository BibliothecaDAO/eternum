// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveHyperstructureForgeBatchSize, resolveHyperstructureForgeCount } from "./game-entry-forge.utils";

describe("game entry forge helpers", () => {
  it("forges one hyperstructure per mainnet transaction", () => {
    expect(resolveHyperstructureForgeBatchSize("mainnet")).toBe(1);
  });

  it("forges up to four hyperstructures on non-mainnet worlds", () => {
    expect(resolveHyperstructureForgeBatchSize("sepolia")).toBe(4);
  });

  it("does not create a forge transaction when the dashboard count is already zero", () => {
    expect(resolveHyperstructureForgeCount({ numHyperstructuresLeft: 0, batchSize: 4 })).toBe(0);
  });

  it("caps the next forge transaction to the remaining dashboard count", () => {
    expect(resolveHyperstructureForgeCount({ numHyperstructuresLeft: 3, batchSize: 4 })).toBe(3);
  });
});
