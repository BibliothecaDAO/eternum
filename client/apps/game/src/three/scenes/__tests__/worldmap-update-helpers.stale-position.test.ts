import { describe, expect, it, vi } from "vitest";

import { processExplorerTroopsUpdate } from "../worldmap-update-helpers";

const baseUpdate = {
  entityId: 7,
  troopCount: 100,
  hexCoords: { col: 2100, row: 2100 },
} as any;

describe("processExplorerTroopsUpdate stale-position skip", () => {
  it("skips updateArmyHexes but still applies updateArmyFromExplorerTroopsUpdate when stale", () => {
    const updateArmyHexes = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => true);
    const onAuthoritativePositionApplied = vi.fn();

    processExplorerTroopsUpdate(baseUpdate, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
      shouldSkipStalePositionUpdate,
    });

    expect(shouldSkipStalePositionUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ x: expect.any(Number) }));
    expect(updateArmyHexes).not.toHaveBeenCalled();
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(baseUpdate);
    expect(onAuthoritativePositionApplied).not.toHaveBeenCalled();
  });

  it("applies both handlers when the predicate returns false", () => {
    const updateArmyHexes = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => false);
    const onAuthoritativePositionApplied = vi.fn();

    processExplorerTroopsUpdate(baseUpdate, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
      shouldSkipStalePositionUpdate,
    });

    expect(updateArmyHexes).toHaveBeenCalledWith(baseUpdate);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(baseUpdate);
    expect(onAuthoritativePositionApplied).toHaveBeenCalledWith(baseUpdate);
  });

  it("never consults the predicate on zero-troop removal events", () => {
    const updateArmyHexes = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => true);
    const onAuthoritativePositionApplied = vi.fn();

    processExplorerTroopsUpdate(
      { ...baseUpdate, troopCount: 0 },
      {
        cancelPendingArmyRemoval: vi.fn(),
        scheduleArmyRemoval,
        updateArmyHexes,
        updateArmyFromExplorerTroopsUpdate,
        onAuthoritativePositionApplied,
        shouldSkipStalePositionUpdate,
      },
    );

    expect(shouldSkipStalePositionUpdate).not.toHaveBeenCalled();
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalled();
    expect(onAuthoritativePositionApplied).not.toHaveBeenCalled();
    expect(scheduleArmyRemoval).toHaveBeenCalledWith(7, "zero");
  });
});
