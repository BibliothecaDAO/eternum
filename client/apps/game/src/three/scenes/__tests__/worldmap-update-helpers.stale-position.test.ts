import { describe, expect, it, vi } from "vitest";

import { processExplorerTroopsUpdate } from "../worldmap-update-helpers";

const baseUpdate = {
  entityId: 7,
  troopCount: 100,
  hexCoords: { col: 2100, row: 2100 },
} as any;

describe("processExplorerTroopsUpdate stale-position skip", () => {
  it("skips position work but still applies updateArmyFromExplorerTroopsUpdate when stale", async () => {
    const updateArmyHexes = vi.fn();
    const moveArmyToAuthoritativeExplorerTroopsPosition = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => true);
    const onAuthoritativePositionApplied = vi.fn();

    await processExplorerTroopsUpdate(baseUpdate, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes,
      moveArmyToAuthoritativeExplorerTroopsPosition,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
      shouldSkipStalePositionUpdate,
    });

    expect(shouldSkipStalePositionUpdate).toHaveBeenCalledWith(7, expect.objectContaining({ x: expect.any(Number) }));
    expect(updateArmyHexes).not.toHaveBeenCalled();
    expect(moveArmyToAuthoritativeExplorerTroopsPosition).not.toHaveBeenCalled();
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(baseUpdate);
    expect(onAuthoritativePositionApplied).not.toHaveBeenCalled();
  });

  it("animates and applies state when the predicate returns false", async () => {
    const updateArmyHexes = vi.fn();
    const moveArmyToAuthoritativeExplorerTroopsPosition = vi.fn(async () => {});
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => false);
    const onAuthoritativePositionApplied = vi.fn();

    await processExplorerTroopsUpdate(baseUpdate, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes,
      moveArmyToAuthoritativeExplorerTroopsPosition,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
      shouldSkipStalePositionUpdate,
    });

    expect(updateArmyHexes).toHaveBeenCalledWith(baseUpdate);
    expect(moveArmyToAuthoritativeExplorerTroopsPosition).toHaveBeenCalledWith(baseUpdate);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(baseUpdate);
    expect(onAuthoritativePositionApplied).toHaveBeenCalledWith(baseUpdate);
  });

  it("never consults the predicate on zero-troop removal events", async () => {
    const updateArmyHexes = vi.fn();
    const moveArmyToAuthoritativeExplorerTroopsPosition = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const shouldSkipStalePositionUpdate = vi.fn(() => true);
    const onAuthoritativePositionApplied = vi.fn();

    await processExplorerTroopsUpdate(
      { ...baseUpdate, troopCount: 0 },
      {
        cancelPendingArmyRemoval: vi.fn(),
        scheduleArmyRemoval,
        updateArmyHexes,
        moveArmyToAuthoritativeExplorerTroopsPosition,
        updateArmyFromExplorerTroopsUpdate,
        onAuthoritativePositionApplied,
        shouldSkipStalePositionUpdate,
      },
    );

    expect(shouldSkipStalePositionUpdate).not.toHaveBeenCalled();
    expect(moveArmyToAuthoritativeExplorerTroopsPosition).not.toHaveBeenCalled();
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalled();
    expect(onAuthoritativePositionApplied).not.toHaveBeenCalled();
    expect(scheduleArmyRemoval).toHaveBeenCalledWith(7, "zero");
  });
});
