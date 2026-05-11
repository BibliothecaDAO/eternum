// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveHyperstructureForgeBatchSize, resolveHyperstructureForgeCount } from "./game-entry-forge.utils";

describe("game entry forge helpers", () => {
  it("reserves twenty-five hyperstructures per transaction by default", () => {
    expect(resolveHyperstructureForgeBatchSize()).toBe(25);
  });

  it("does not create a forge transaction when the dashboard count is already zero", () => {
    expect(resolveHyperstructureForgeCount({ numHyperstructuresLeft: 0, batchSize: 25 })).toBe(0);
  });

  it("caps the next forge transaction to the remaining dashboard count", () => {
    expect(resolveHyperstructureForgeCount({ numHyperstructuresLeft: 3, batchSize: 25 })).toBe(3);
  });
});
