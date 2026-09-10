// @vitest-environment node

import { createStore } from "zustand/vanilla";
import { describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { RealmStore } from "./use-realm-store";

vi.mock("@bibliothecadao/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/types")>();
  return {
    ...actual,
    StructureType: {
      Realm: 1,
      Village: 2,
      Bank: 3,
      FragmentMine: 4,
    },
    RelicRecipientType: {
      Structure: "Structure",
      Army: "Army",
    },
  };
});

const StructureType = {
  Realm: 1,
  Village: 2,
  Bank: 3,
  FragmentMine: 4,
} as const;

const { createRealmStoreSlice } = await import("./use-realm-store");

configManager.mapCenter = 2010831280;

type RealmStoreState = RealmStore;
type PlayerStructure = RealmStoreState["playerStructures"][number];

const createRealmStoreTestHarness = () => {
  let state = {} as RealmStoreState;

  const set = (update: any) => {
    const partial = typeof update === "function" ? update(state) : update;
    if (!partial) {
      return;
    }
    state = { ...state, ...partial };
  };

  state = createRealmStoreSlice(set);

  return {
    getState: () => state,
    setState: (partial: Partial<RealmStoreState>) => {
      state = { ...state, ...partial };
    },
  };
};

const makeStructure = (
  entityId: number,
  category: (typeof StructureType)[keyof typeof StructureType] = StructureType.Realm,
) =>
  ({
    entityId,
    category,
  }) as unknown as PlayerStructure;

describe("use-realm-store spectator lifecycle", () => {
  it("enters spectator mode while preserving last controlled owned structure", () => {
    const harness = createRealmStoreTestHarness();
    harness.setState({
      structureEntityId: 101,
      isSpectating: false,
      playerStructures: [makeStructure(101), makeStructure(202)],
    });

    harness.getState().setStructureEntityId(303, {
      spectator: true,
      worldMapPosition: { col: 12, row: 34 },
    });

    const next = harness.getState();
    expect(next.structureEntityId).toBe(303);
    expect(next.isSpectating).toBe(true);
    expect(next.lastControlledStructureEntityId).toBe(101);
    expect(next.worldMapReturnPosition).toEqual({ col: 12, row: 34 });
  });

  it("normalizes contract-space world map positions before storing route resume state", () => {
    const harness = createRealmStoreTestHarness();
    harness.setState({
      structureEntityId: 101,
      isSpectating: false,
      playerStructures: [makeStructure(101), makeStructure(202)],
    });

    harness.getState().setStructureEntityId(303, {
      spectator: true,
      worldMapPosition: { col: 2010831286, row: 2010831278 },
    });

    const next = harness.getState();
    expect(next.worldMapReturnPosition).toEqual({ col: 6, row: -2 });
  });

  it("recovers from startup spectator state when player structures become available", () => {
    const harness = createRealmStoreTestHarness();
    harness.setState({
      isSpectating: true,
      structureEntityId: 999,
      lastControlledStructureEntityId: UNDEFINED_STRUCTURE_ENTITY_ID,
      playerStructures: [],
    });

    harness.getState().setPlayerStructures([makeStructure(777), makeStructure(888, StructureType.Village)]);

    const next = harness.getState();
    expect(next.isSpectating).toBe(false);
    expect(next.structureEntityId).toBe(777);
    expect(next.lastControlledStructureEntityId).toBe(777);
  });

  it("exits spectator mode using last controlled structure fallback", () => {
    const harness = createRealmStoreTestHarness();
    harness.setState({
      isSpectating: true,
      structureEntityId: 999,
      lastControlledStructureEntityId: 444,
    });

    harness.getState().exitSpectatorMode();

    const next = harness.getState();
    expect(next.isSpectating).toBe(false);
    expect(next.structureEntityId).toBe(444);
  });
});

it("publishes arrival badges only when their counts or ordered structure IDs change", () => {
  const store = createStore<RealmStore>((set) => createRealmStoreSlice(set));
  const listener = vi.fn();
  store.subscribe(listener);
  const setIndicators = store.getState().setArrivalIndicators;
  for (let tick = 0; tick < 60; tick++) {
    setIndicators({ arrivedArrivalsNumber: 0, pendingArrivalsNumber: 0, arrivedArrivalStructureIds: [] });
  }
  expect(listener).not.toHaveBeenCalled();
  const indicators = { arrivedArrivalsNumber: 2, pendingArrivalsNumber: 1, arrivedArrivalStructureIds: [7, 8] };
  setIndicators(indicators);
  const committed = store.getState();
  setIndicators({ ...indicators, arrivedArrivalStructureIds: [7, 8] });
  expect(store.getState()).toBe(committed);
  expect(listener).toHaveBeenCalledTimes(1);
  setIndicators({ ...indicators, arrivedArrivalStructureIds: [8, 7] });
  setIndicators({ ...indicators, pendingArrivalsNumber: 2 });
  expect(listener).toHaveBeenCalledTimes(3);
});
