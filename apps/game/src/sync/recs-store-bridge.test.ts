import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { useUIStore } from "@/hooks/store/use-ui-store";
import { useWorldSlicesStore } from "@/hooks/store/use-world-slices-store";
import { defineContractComponents } from "@bibliothecadao/types";
import { createWorld } from "@dojoengine/recs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRecsGameSyncStore } from "./recs-game-sync-store";
import { installRecsStoreBridge } from "./recs-store-bridge";

interface ParityEntity {
  hashed_keys: string;
  models: Record<string, Record<string, unknown>>;
}

// A real herald Structure row (from the parity fixture) written through the real store: RECS only reads back
// complete rows, so a hand-made partial would never reach the bridge.
const structureRow = (
  JSON.parse(readFileSync(resolve(process.cwd(), "src/sync/recs-game-sync-store.parity.json"), "utf8")) as {
    entities: ParityEntity[];
  }
).entities.find((entity) => "Structure" in entity.models)!;

const createHarness = () => {
  const world = createWorld();
  const components = defineContractComponents(world, "s2");
  const store = createRecsGameSyncStore({ network: { contractComponents: components, world } } as never, ["Structure"]);
  let sliceApplied: (() => void) | null = null;
  const runtime = {
    subscribeSliceApplied: (listener: () => void) => {
      sliceApplied = listener;
      return () => {
        sliceApplied = null;
      };
    },
  };
  const writeStructures = (entityIds: number[]) =>
    store.applyEntityOperations([
      {
        type: "upsert",
        entities: entityIds.map((entityId) => ({
          hashed_keys: `0x${entityId.toString(16)}`,
          models: { Structure: { ...structureRow.models.Structure, entity_id: `0x${entityId.toString(16)}` } },
        })),
      },
    ]);
  return {
    applySlice: () => sliceApplied?.(),
    hasSliceListener: () => sliceApplied !== null,
    install: () => installRecsStoreBridge({ components: components as never, runtime: runtime as never }),
    writeStructures,
  };
};

describe("RECS → store bridge", () => {
  const setSlices = vi.spyOn(useWorldSlicesStore, "setState");
  const setUi = vi.spyOn(useUIStore, "setState");
  const disposers: Array<() => void> = [];

  beforeEach(() => {
    setSlices.mockClear();
    setUi.mockClear();
  });

  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose());
    useWorldSlicesStore.setState({ structures: [] });
  });

  it("derives every slice once at install, then once per applied slice however many rows changed", () => {
    const harness = createHarness();
    disposers.push(harness.install());

    expect(setSlices).toHaveBeenCalledTimes(1);
    expect(setUi).toHaveBeenCalledTimes(2); // the season clock, then the derived player facts
    expect(harness.hasSliceListener()).toBe(true);

    setSlices.mockClear();
    harness.writeStructures([1, 2, 3]);
    expect(setSlices).not.toHaveBeenCalled();

    harness.applySlice();
    expect(setSlices).toHaveBeenCalledTimes(1);
    expect(useWorldSlicesStore.getState().structures.map((structure) => structure.entity_id)).toEqual([1, 2, 3]);

    harness.applySlice();
    expect(setSlices).toHaveBeenCalledTimes(1);
  });

  it("derives for selection and relic changes only among store writes", () => {
    const harness = createHarness();
    disposers.push(harness.install());
    setUi.mockClear();

    useUIStore.setState({ isLoadingScreenEnabled: !useUIStore.getState().isLoadingScreenEnabled } as never);
    expect(setUi).toHaveBeenCalledTimes(1); // the write itself, nothing derived behind it

    // Store actions call the creator's own set, which the spy does not see; the bridge's write does.
    useUIStore.getState().triggerRelicsRefresh();
    expect(setUi).toHaveBeenCalledTimes(2);
    expect(setUi.mock.calls[1]?.[0]).toHaveProperty("playerRelics");
  });

  it("stops deriving once disposed", () => {
    const harness = createHarness();
    const dispose = harness.install();
    dispose();
    expect(harness.hasSliceListener()).toBe(false);
    setSlices.mockClear();

    harness.writeStructures([9]);
    harness.applySlice();
    useUIStore.getState().triggerRelicsRefresh();

    expect(setSlices).not.toHaveBeenCalled();
    expect(useWorldSlicesStore.getState().structures).toHaveLength(0);
  });
});
