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
    const onAuthoritativePositionApplied = vi.fn();

    const update = {
      entityId: 7,
      troopCount: 12,
      hexCoords: { col: 2100, row: 2100 },
    } as any;

    processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval,
      scheduleArmyRemoval,
      updateArmyHexes,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
    });

    expect(cancelPendingArmyRemoval).toHaveBeenCalledWith(7);
    expect(updateArmyHexes).toHaveBeenCalledWith(update);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(update);
    expect(onAuthoritativePositionApplied).toHaveBeenCalledWith(update);
    expect(scheduleArmyRemoval).not.toHaveBeenCalled();
  });

  it("notifies after applying the authoritative army update", () => {
    const callOrder: string[] = [];
    const update = {
      entityId: 9,
      troopCount: 20,
      hexCoords: { col: 2103, row: 2104 },
    } as any;

    processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes: vi.fn(() => callOrder.push("hexes")),
      updateArmyFromExplorerTroopsUpdate: vi.fn(() => callOrder.push("army")),
      onAuthoritativePositionApplied: vi.fn(() => callOrder.push("pending-clear")),
    });

    expect(callOrder).toEqual(["hexes", "army", "pending-clear"]);
  });
});
