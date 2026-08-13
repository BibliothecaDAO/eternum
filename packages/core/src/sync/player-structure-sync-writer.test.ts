import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PlayerStructureSyncWriter,
  selectUnsyncedOwnedStructureTargets,
  type PlayerStructureSyncTarget,
} from "./player-structure-sync-writer";

afterEach(() => vi.useRealTimers());

describe("selectUnsyncedOwnedStructureTargets", () => {
  it("returns each valid structure that is neither present nor in flight", () => {
    const targets = selectUnsyncedOwnedStructureTargets({
      ownedStructures: [
        { entity_id: 10, coord_x: 4, coord_y: -2 },
        { entity_id: 10, coord_x: 8, coord_y: 9 },
        { entity_id: 11, coord_x: Number.NaN, coord_y: 3 },
        { entity_id: 12, coord_x: 5, coord_y: -3 },
      ],
      currentPlayerStructureIds: new Set([12]),
      inFlightStructureIds: new Set(),
    });

    expect(targets).toEqual([{ entityId: 10, position: { col: 4, row: -2 } }]);
  });
});

describe("PlayerStructureSyncWriter", () => {
  it("owns subscriptions, target hydration, reconnect, and cleanup", async () => {
    vi.useFakeTimers();
    const subscriptions = Array.from({ length: 5 }, () => ({ cancel: vi.fn() }));
    const [
      initialOwnerSubscription,
      initialPlayerSubscription,
      updatedPlayerSubscription,
      reconnectedOwnerSubscription,
      reconnectedPlayerSubscription,
    ] = subscriptions;
    const subscribeToOwnerChanges = vi.fn(async () => subscriptions.shift()!);
    const subscribeToPlayerState = vi.fn(async () => subscriptions.shift()!);
    const hydrateStructures = vi.fn(async (_targets: readonly PlayerStructureSyncTarget[]) => undefined);
    const fetchOwnedStructures = vi.fn(async () => []);
    const writer = new PlayerStructureSyncWriter({
      fetchOwnedStructures,
      hydrateStructures,
      subscribeToOwnerChanges,
      subscribeToPlayerState,
      reconciliationIntervalMs: 10_000,
    });
    const initialTargets = [{ entityId: 1, position: { col: 2, row: 3 } }];

    writer.start(initialTargets);
    await vi.runAllTicks();
    expect(hydrateStructures).toHaveBeenCalledWith(initialTargets);
    expect(subscribeToPlayerState).toHaveBeenCalledWith(initialTargets);

    const nextTargets = [...initialTargets, { entityId: 2, position: { col: 4, row: 5 } }];
    writer.updateTargets(nextTargets);
    await vi.runAllTicks();
    expect(hydrateStructures).toHaveBeenLastCalledWith([nextTargets[1]]);
    expect(subscribeToPlayerState).toHaveBeenLastCalledWith(nextTargets);

    writer.reconnect();
    await vi.runAllTicks();
    expect(subscribeToOwnerChanges).toHaveBeenCalledTimes(2);
    expect(subscribeToPlayerState).toHaveBeenCalledTimes(3);
    expect(fetchOwnedStructures).toHaveBeenCalledTimes(2);

    writer.cancel();
    expect(initialOwnerSubscription.cancel).toHaveBeenCalledOnce();
    expect(initialPlayerSubscription.cancel).toHaveBeenCalledOnce();
    expect(updatedPlayerSubscription.cancel).toHaveBeenCalledOnce();
    expect(reconnectedOwnerSubscription.cancel).toHaveBeenCalledOnce();
    expect(reconnectedPlayerSubscription.cancel).toHaveBeenCalledOnce();
  });
});
