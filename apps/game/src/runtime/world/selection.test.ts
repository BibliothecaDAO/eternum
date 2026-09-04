// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildWorldProfile: vi.fn(),
  getWorldProfile: vi.fn(),
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
  getWorldProfile: mocks.getWorldProfile,
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
    mocks.getWorldProfile.mockReset();
    mocks.getWorldProfile.mockReturnValue(null);
    mocks.resolveChain.mockReset();
    mocks.setSelectedChain.mockReset();
    mocks.setActiveWorldName.mockReset();
    mocks.markGameEntryMilestone.mockReset();
    mocks.recordGameEntryDuration.mockReset();
  });

  it("persists the selected chain even when it matches the resolved chain", async () => {
    mocks.resolveChain.mockReturnValue("madara");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "madara" });

    const result = await applyWorldSelection({ name: "mainnet-king-1", chain: "madara" }, "madara");

    expect(result.chainChanged).toBe(false);
    expect(mocks.setSelectedChain).toHaveBeenCalledTimes(1);
    expect(mocks.setSelectedChain).toHaveBeenCalledWith("madara");
  });

  it("persists fallback chain when selection chain is omitted", async () => {
    mocks.resolveChain.mockReturnValue("madara");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "madara" });

    await applyWorldSelection({ name: "mainnet-king-1" }, "madara");

    expect(mocks.setSelectedChain).toHaveBeenCalledTimes(1);
    expect(mocks.setSelectedChain).toHaveBeenCalledWith("madara");
  });

  it("reuses the immutable game profile when an in-game route reloads without Torii", async () => {
    const saved = { name: "mainnet-king-1", chain: "madara", gameId: 54 };
    mocks.resolveChain.mockReturnValue("madara");
    mocks.getWorldProfile.mockReturnValue(saved);

    const result = await applyWorldSelection({ name: "mainnet-king-1", chain: "madara" }, "madara");

    expect(result.profile).toBe(saved);
    expect(mocks.buildWorldProfile).not.toHaveBeenCalled();
  });

  it("records selection milestones and durations around profile building and persistence", async () => {
    const nowSpy = vi.spyOn(performance, "now");
    nowSpy.mockReturnValueOnce(100);
    nowSpy.mockReturnValueOnce(250);
    nowSpy.mockReturnValueOnce(265);
    nowSpy.mockReturnValueOnce(320);
    nowSpy.mockReturnValueOnce(340);
    nowSpy.mockReturnValueOnce(340);

    mocks.resolveChain.mockReturnValue("madara");
    mocks.buildWorldProfile.mockResolvedValue({ name: "mainnet-king-1", chain: "madara" });

    await applyWorldSelection({ name: "mainnet-king-1", chain: "madara" }, "madara");

    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-profile-build-started");
    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-profile-build-completed");
    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-profile-resolved");
    expect(mocks.markGameEntryMilestone).toHaveBeenCalledWith("world-selection-state-persisted");
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-profile-build", 15);
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-selection-state-persist", 20);
    expect(mocks.recordGameEntryDuration).toHaveBeenCalledWith("world-selection-total", 240);
  });
});
