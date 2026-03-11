// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildWorldProfile: vi.fn(),
  resolveChain: vi.fn(),
  setSelectedChain: vi.fn(),
  setActiveWorldName: vi.fn(),
}));

vi.mock("./profile-builder", () => ({
  buildWorldProfile: mocks.buildWorldProfile,
}));

vi.mock("./store", () => ({
  resolveChain: mocks.resolveChain,
  setSelectedChain: mocks.setSelectedChain,
  setActiveWorldName: mocks.setActiveWorldName,
}));

import { applyWorldSelection } from "./selection";

describe("applyWorldSelection", () => {
  beforeEach(() => {
    mocks.buildWorldProfile.mockReset();
    mocks.resolveChain.mockReset();
    mocks.setSelectedChain.mockReset();
    mocks.setActiveWorldName.mockReset();
  });

  it("persists the selected chain even when it matches the resolved chain", async () => {
    mocks.resolveChain.mockReturnValue("mainnet");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "mainnet" });

    const result = await applyWorldSelection({ name: "mainnet-king-1", chain: "mainnet" }, "mainnet");

    expect(result.chainChanged).toBe(false);
    expect(mocks.setSelectedChain).toHaveBeenCalledTimes(1);
    expect(mocks.setSelectedChain).toHaveBeenCalledWith("mainnet");
  });

  it("persists fallback chain when selection chain is omitted", async () => {
    mocks.resolveChain.mockReturnValue("mainnet");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "mainnet" });

    await applyWorldSelection({ name: "mainnet-king-1" }, "mainnet");

    expect(mocks.setSelectedChain).toHaveBeenCalledTimes(1);
    expect(mocks.setSelectedChain).toHaveBeenCalledWith("mainnet");
  });
});
