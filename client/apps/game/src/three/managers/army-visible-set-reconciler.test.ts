import { describe, expect, it, vi } from "vitest";

import type { ID } from "@bibliothecadao/types";

import { reconcileVisibleArmySet } from "./army-visible-set-reconciler";

type VisibleArmyStub = { entityId: ID };
type ModelTypeStub = string;

describe("reconcileVisibleArmySet", () => {
  it("removes stale armies, adds missing ones, force-refreshes tracked armies, and flushes buffers once", () => {
    const currentVisibleOrder: ID[] = [9 as ID, 2 as ID, 1 as ID];
    const visibleArmySlots = new Map<ID, number>([
      [9 as ID, 0],
      [2 as ID, 1],
      [1 as ID, 2],
    ]);
    const trackedLabels = new Map<ID, string>([
      [9 as ID, "stale"],
      [2 as ID, "kept"],
      [7 as ID, "orphaned"],
    ]);
    let nextSlot = 3;

    const removeVisibleArmy = vi.fn((entityId: ID) => {
      visibleArmySlots.delete(entityId);
      const orderIndex = currentVisibleOrder.indexOf(entityId);
      if (orderIndex >= 0) {
        currentVisibleOrder.splice(orderIndex, 1);
      }
      trackedLabels.delete(entityId);
      return 1;
    });
    const addVisibleArmy = vi.fn((army: VisibleArmyStub) => {
      currentVisibleOrder.push(army.entityId);
      visibleArmySlots.set(army.entityId, nextSlot++);
    });
    const refreshVisibleArmy = vi.fn();
    const removeEntityIdLabel = vi.fn((entityId: ID) => {
      trackedLabels.delete(entityId);
    });
    const commitVisibleArmyOrder = vi.fn();
    const refreshVisibleArmyCollection = vi.fn();
    const syncVisibleArmyAttachments = vi.fn();
    const updateArmyAttachmentTransforms = vi.fn();
    const flushVisibleArmyBuffers = vi.fn();

    reconcileVisibleArmySet<VisibleArmyStub, ModelTypeStub, ID>({
      desiredVisibleArmies: [{ entityId: 2 as ID }, { entityId: 4 as ID }, { entityId: 1 as ID }],
      modelTypesByEntity: new Map<ID, ModelTypeStub>([
        [1 as ID, "infantry"],
        [2 as ID, "cavalry"],
        [4 as ID, "mage"],
      ]),
      forceRefresh: true,
      currentVisibleOrder,
      forEachTrackedLabel: (visit) => {
        trackedLabels.forEach((_, entityId) => visit(entityId));
      },
      getVisibleArmySlot: (entityId) => visibleArmySlots.get(entityId),
      removeVisibleArmy,
      addVisibleArmy,
      refreshVisibleArmy,
      removeEntityIdLabel,
      commitVisibleArmyOrder,
      refreshVisibleArmyCollection,
      syncVisibleArmyAttachments,
      updateArmyAttachmentTransforms,
      flushVisibleArmyBuffers,
      sortEntityIds: (entityIds) => entityIds.toSorted((a, b) => Number(a) - Number(b)),
    });

    expect(removeVisibleArmy).toHaveBeenCalledTimes(1);
    expect(removeVisibleArmy).toHaveBeenCalledWith(9);
    expect(addVisibleArmy).toHaveBeenCalledTimes(1);
    expect(addVisibleArmy).toHaveBeenCalledWith({ entityId: 4 }, "mage");
    expect(refreshVisibleArmy).toHaveBeenCalledTimes(3);
    expect(refreshVisibleArmy).toHaveBeenNthCalledWith(1, { entityId: 2 }, 1, "cavalry");
    expect(refreshVisibleArmy).toHaveBeenNthCalledWith(2, { entityId: 4 }, 3, "mage");
    expect(refreshVisibleArmy).toHaveBeenNthCalledWith(3, { entityId: 1 }, 2, "infantry");
    expect(removeEntityIdLabel).toHaveBeenCalledTimes(1);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(7);
    expect(commitVisibleArmyOrder).toHaveBeenCalledWith([2, 4, 1]);
    expect(refreshVisibleArmyCollection).toHaveBeenCalledTimes(1);
    expect(syncVisibleArmyAttachments).toHaveBeenCalledTimes(1);
    expect(updateArmyAttachmentTransforms).toHaveBeenCalledTimes(1);
    expect(flushVisibleArmyBuffers).toHaveBeenCalledTimes(1);
  });

  it("preserves presentation updates on no-op passes without flushing buffers", () => {
    const currentVisibleOrder: ID[] = [2 as ID, 1 as ID];
    const visibleArmySlots = new Map<ID, number>([
      [2 as ID, 0],
      [1 as ID, 1],
    ]);
    const trackedLabels = new Map<ID, string>([
      [2 as ID, "kept"],
      [5 as ID, "stale"],
    ]);

    const removeVisibleArmy = vi.fn();
    const addVisibleArmy = vi.fn();
    const refreshVisibleArmy = vi.fn();
    const removeEntityIdLabel = vi.fn((entityId: ID) => {
      trackedLabels.delete(entityId);
    });
    const commitVisibleArmyOrder = vi.fn();
    const refreshVisibleArmyCollection = vi.fn();
    const syncVisibleArmyAttachments = vi.fn();
    const updateArmyAttachmentTransforms = vi.fn();
    const flushVisibleArmyBuffers = vi.fn();

    reconcileVisibleArmySet<VisibleArmyStub, ModelTypeStub, ID>({
      desiredVisibleArmies: [{ entityId: 2 as ID }, { entityId: 1 as ID }],
      modelTypesByEntity: new Map<ID, ModelTypeStub>([
        [1 as ID, "infantry"],
        [2 as ID, "cavalry"],
      ]),
      currentVisibleOrder,
      forEachTrackedLabel: (visit) => {
        trackedLabels.forEach((_, entityId) => visit(entityId));
      },
      getVisibleArmySlot: (entityId) => visibleArmySlots.get(entityId),
      removeVisibleArmy,
      addVisibleArmy,
      refreshVisibleArmy,
      removeEntityIdLabel,
      commitVisibleArmyOrder,
      refreshVisibleArmyCollection,
      syncVisibleArmyAttachments,
      updateArmyAttachmentTransforms,
      flushVisibleArmyBuffers,
      sortEntityIds: (entityIds) => entityIds.toSorted((a, b) => Number(a) - Number(b)),
    });

    expect(removeVisibleArmy).not.toHaveBeenCalled();
    expect(addVisibleArmy).not.toHaveBeenCalled();
    expect(refreshVisibleArmy).not.toHaveBeenCalled();
    expect(removeEntityIdLabel).toHaveBeenCalledTimes(1);
    expect(removeEntityIdLabel).toHaveBeenCalledWith(5);
    expect(commitVisibleArmyOrder).toHaveBeenCalledWith([2, 1]);
    expect(refreshVisibleArmyCollection).toHaveBeenCalledTimes(1);
    expect(syncVisibleArmyAttachments).toHaveBeenCalledTimes(1);
    expect(updateArmyAttachmentTransforms).toHaveBeenCalledTimes(1);
    expect(flushVisibleArmyBuffers).not.toHaveBeenCalled();
  });
});
