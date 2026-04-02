// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildWorldProfile: vi.fn(),
  resolveChain: vi.fn(),
  setSelectedChain: vi.fn(),
  setActiveWorldName: vi.fn(),
  markGameEntryMilestone: vi.fn(),
  recordGameEntryDuration: vi.fn(),
}));

vi.mock("./profile-builder", () => ({
  buildWorldProfile: mocks.buildWorldProfile,
}));

vi.mock("./store", () => ({
  resolveChain: mocks.resolveChain,
  setSelectedChain: mocks.setSelectedChain,
  setActiveWorldName: mocks.setActiveWorldName,
}));

vi.mock("@/ui/layouts/game-entry-timeline", () => ({
  markGameEntryMilestone: mocks.markGameEntryMilestone,
  recordGameEntryDuration: mocks.recordGameEntryDuration,
}));

import { applyWorldSelection } from "./selection";

describe("applyWorldSelection", () => {
  beforeEach(() => {
    mocks.buildWorldProfile.mockReset();
    mocks.resolveChain.mockReset();
    mocks.setSelectedChain.mockReset();
    mocks.setActiveWorldName.mockReset();
    mocks.markGameEntryMilestone.mockReset();
    mocks.recordGameEntryDuration.mockReset();
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

  it("records selection milestones and durations around profile building and persistence", async () => {
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(100);
    nowSpy.mockReturnValueOnce(250);
    nowSpy.mockReturnValueOnce(265);
    nowSpy.mockReturnValueOnce(320);
    nowSpy.mockReturnValueOnce(340);
    nowSpy.mockReturnValueOnce(340);

    mocks.resolveChain.mockReturnValue("mainnet");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "mainnet" });

    await applyWorldSelection({ name: "mainnet-king-1", chain: "mainnet" }, "mainnet");

    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-profile-build-started");
    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-profile-build-completed");
    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-selection-state-persisted");
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-profile-build", 15);
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-selection-state-persist", 20);
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-selection-total", 240);
  });
});
