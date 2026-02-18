import { describe, expect, it, vi } from "vitest";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";

vi.mock("@bibliothecadao/types", () => ({
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
}));

const StructureType = {
  Realm: 1,
  Village: 2,
  Bank: 3,
  FragmentMine: 4,
} as const;

const { createRealmStoreSlice } = await import("./use-realm-store");

type RealmStoreState = ReturnType<typeof createRealmStoreSlice>;

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

const makeStructure = (entityId: number, category: StructureType = StructureType.Realm) =>
  ({
    entityId,
    category,
  }) as any;

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
