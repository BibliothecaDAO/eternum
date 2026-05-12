import { describe, expect, it, vi } from "vitest";

import { enqueueExplorerTroopsUpdate, processExplorerTroopsUpdate } from "../worldmap-update-helpers";

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
};

describe("processExplorerTroopsUpdate", () => {
  it("updates army data before scheduling zero-count removal", async () => {
    const cancelPendingArmyRemoval = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const updateArmyHexes = vi.fn();
    const moveArmyToAuthoritativeExplorerTroopsPosition = vi.fn();
    const updateArmyFromExplorerTroopsUpdate = vi.fn();

    const update = {
      entityId: 42,
      troopCount: 0,
    } as any;

    await processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval,
      scheduleArmyRemoval,
      updateArmyHexes,
      moveArmyToAuthoritativeExplorerTroopsPosition,
      updateArmyFromExplorerTroopsUpdate,
    });

    expect(cancelPendingArmyRemoval).toHaveBeenCalledWith(42);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(update);
    expect(updateArmyHexes).not.toHaveBeenCalled();
    expect(moveArmyToAuthoritativeExplorerTroopsPosition).not.toHaveBeenCalled();
    expect(scheduleArmyRemoval).toHaveBeenCalledWith(42, "zero");
  });

  it("animates the authoritative position before updating army state for living armies", async () => {
    const cancelPendingArmyRemoval = vi.fn();
    const scheduleArmyRemoval = vi.fn();
    const updateArmyHexes = vi.fn();
    const moveArmyToAuthoritativeExplorerTroopsPosition = vi.fn(async () => {});
    const updateArmyFromExplorerTroopsUpdate = vi.fn();
    const onAuthoritativePositionApplied = vi.fn();

    const update = {
      entityId: 7,
      troopCount: 12,
      hexCoords: { col: 2100, row: 2100 },
    } as any;

    await processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval,
      scheduleArmyRemoval,
      updateArmyHexes,
      moveArmyToAuthoritativeExplorerTroopsPosition,
      updateArmyFromExplorerTroopsUpdate,
      onAuthoritativePositionApplied,
    });

    expect(cancelPendingArmyRemoval).toHaveBeenCalledWith(7);
    expect(updateArmyHexes).toHaveBeenCalledWith(update);
    expect(moveArmyToAuthoritativeExplorerTroopsPosition).toHaveBeenCalledWith(update);
    expect(updateArmyFromExplorerTroopsUpdate).toHaveBeenCalledWith(update);
    expect(onAuthoritativePositionApplied).toHaveBeenCalledWith(update);
    expect(scheduleArmyRemoval).not.toHaveBeenCalled();
  });

  it("notifies after animating and applying the authoritative army update", async () => {
    const callOrder: string[] = [];
    const update = {
      entityId: 9,
      troopCount: 20,
      hexCoords: { col: 2103, row: 2104 },
    } as any;

    await processExplorerTroopsUpdate(update, {
      cancelPendingArmyRemoval: vi.fn(),
      scheduleArmyRemoval: vi.fn(),
      updateArmyHexes: vi.fn(() => callOrder.push("hexes")),
      moveArmyToAuthoritativeExplorerTroopsPosition: vi.fn(async () => {
        callOrder.push("movement");
      }),
      updateArmyFromExplorerTroopsUpdate: vi.fn(() => callOrder.push("army")),
      onAuthoritativePositionApplied: vi.fn(() => callOrder.push("pending-clear")),
    });

    expect(callOrder).toEqual(["hexes", "movement", "army", "pending-clear"]);
  });
});

describe("enqueueExplorerTroopsUpdate", () => {
  it("serializes async updates for the same army", async () => {
    const queue = new Map();
    const firstUpdate = { entityId: 7, troopCount: 12, hexCoords: { col: 2101, row: 2101 } } as any;
    const secondUpdate = { entityId: 7, troopCount: 12, hexCoords: { col: 2102, row: 2102 } } as any;
    const firstDeferred = createDeferred();
    const secondDeferred = createDeferred();
    const started: number[] = [];
    const completed: number[] = [];
    const processUpdate = vi.fn(async (update: any) => {
      started.push(update.hexCoords.col);
      await (update === firstUpdate ? firstDeferred.promise : secondDeferred.promise);
      completed.push(update.hexCoords.col);
    });

    enqueueExplorerTroopsUpdate(firstUpdate, queue, { processUpdate });
    enqueueExplorerTroopsUpdate(secondUpdate, queue, { processUpdate });
    const queuedCompletion = queue.get(7)!;

    await flushMicrotasks();
    expect(started).toEqual([2101]);
    expect(processUpdate).toHaveBeenCalledTimes(1);

    firstDeferred.resolve();
    await flushMicrotasks();
    expect(started).toEqual([2101, 2102]);
    expect(completed).toEqual([2101]);

    secondDeferred.resolve();
    await queuedCompletion;
    expect(completed).toEqual([2101, 2102]);
    expect(queue.has(7)).toBe(false);
  });

  it("keeps independent army queues from blocking each other", async () => {
    const queue = new Map();
    const firstDeferred = createDeferred();
    const secondDeferred = createDeferred();
    const started: number[] = [];
    const processUpdate = vi.fn(async (update: any) => {
      started.push(update.entityId);
      await (update.entityId === 7 ? firstDeferred.promise : secondDeferred.promise);
    });

    enqueueExplorerTroopsUpdate({ entityId: 7, troopCount: 12, hexCoords: { col: 1, row: 1 } } as any, queue, {
      processUpdate,
    });
    enqueueExplorerTroopsUpdate({ entityId: 8, troopCount: 12, hexCoords: { col: 2, row: 2 } } as any, queue, {
      processUpdate,
    });

    await flushMicrotasks();
    expect(started).toEqual([7, 8]);

    firstDeferred.resolve();
    secondDeferred.resolve();
    await Promise.all(Array.from(queue.values()));
  });
});
