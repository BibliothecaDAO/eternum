// @vitest-environment node

import { describe, expect, it } from "vitest";

import { getExplorerName, getExplorerTxUrl } from "./types";

describe("transaction explorer links", () => {
  it("stays disabled when the game chain has no configured explorer", () => {
    expect(getExplorerName()).toBe("Explorer");
    expect(getExplorerTxUrl("0xabc")).toBeNull();
  });
});
