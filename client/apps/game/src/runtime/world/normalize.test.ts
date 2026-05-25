// @vitest-environment node

import { describe, expect, it } from "vitest";

import { buildSharedSlotRpcUrl, isSlotWorldChain } from "./normalize";

describe("slot rpc helpers", () => {
  it("builds the shared slot rpc from the cartridge api base", () => {
    expect(buildSharedSlotRpcUrl("https://api.cartridge.gg")).toBe(
      "https://api.cartridge.gg/x/eternum-blitz-slot-4/katana/rpc/v0_9",
    );
  });

  it("treats slot and slottest as slot-world chains", () => {
    expect(isSlotWorldChain("slot")).toBe(true);
    expect(isSlotWorldChain("slottest")).toBe(true);
    expect(isSlotWorldChain("mainnet")).toBe(false);
    expect(isSlotWorldChain("sepolia")).toBe(false);
  });
});
