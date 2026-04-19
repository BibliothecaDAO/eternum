import { describe, expect, it, vi } from "vitest";

import { processExplorerTroopsUpdate } from "../worldmap-update-helpers";

describe("processExplorerTroopsUpdate", () => {
  it("updates army data before scheduling zero-count removal", () => {
    const cancelPendingArmyRemoval = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const updateArmyHexes = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();

    const update = {
      entityId: 42,
      troopCount: 0,
    } as any;

    processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval,
      scheduleArmyRemoval,
      updateArmyHexes,
      updateArmyFromExplorerTroopsUpdate,
    });

    expect(cancelPendingArmyRemoval).toHaveBeenCalledWith(42);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(update);
    expect(updateArmyHexes).not.toHaveBeenCalled();
    expect(scheduleArmyRemoval).toHaveBeenCalledWith(42, "zero");
  });

  it("updates hexes and army state for living armies", () => {
    const cancelPendingArmyRemoval = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const updateArmyHexes = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();

    const update = {
      entityId: 7,
      troopCount: 12,
    } as any;

    processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval,
      scheduleArmyRemoval,
      updateArmyHexes,
      updateArmyFromExplorerTroopsUpdate,
    });

    expect(cancelPendingArmyRemoval).toHaveBeenCalledWith(7);
    expect(updateArmyHexes).toHaveBeenCalledWith(update);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(update);
    expect(scheduleArmyRemoval).not.toHaveBeenCalled();
  });
});
