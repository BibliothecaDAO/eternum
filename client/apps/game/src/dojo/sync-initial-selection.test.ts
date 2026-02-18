import { describe, expect, it, vi } from "vitest";

vi.mock("@bibliothecadao/types", () => ({
  StructureType: {
    Realm: 1,
    Village: 2,
    Bank: 3,
    FragmentMine: 4,
  },
}));

const StructureType = {
  Realm: 1,
  Village: 2,
  Bank: 3,
  FragmentMine: 4,
} as const;

const { resolveInitialStructureSelection } = await import("./sync-initial-selection");

interface SyncedStructureRecord {
  entity_id: number;
  coord_x: number;
  coord_y: number;
  category?: number | string | null;
}

interface InitialStructureSelectionInput {
  ownedStructures: SyncedStructureRecord[];
  firstGlobalStructure: SyncedStructureRecord | null;
}

const structure = (
  entity_id: number,
  coord_x: number,
  coord_y: number,
  category: number | string = StructureType.Village,
): SyncedStructureRecord => ({
  entity_id,
  coord_x,
  coord_y,
  category,
});

const resolve = (input: Partial<InitialStructureSelectionInput>) =>
  resolveInitialStructureSelection({
    ownedStructures: input.ownedStructures ?? [],
    firstGlobalStructure: input.firstGlobalStructure ?? null,
  });

describe("resolveInitialStructureSelection", () => {
  it("prefers owned realm structure when available and does not spectate", () => {
    const selected = resolve({
      ownedStructures: [structure(10, 1, 1, StructureType.Village), structure(22, 9, 9, StructureType.Realm)],
      firstGlobalStructure: structure(99, 5, 5),
    });

    expect(selected).toEqual({
      selectedStructure: { entity_id: 22, coord_x: 9, coord_y: 9 },
      spectator: false,
    });
  });

  it("falls back to first owned structure when no owned realm exists", () => {
    const selected = resolve({
      ownedStructures: [structure(33, 3, 4, StructureType.Village), structure(44, 8, 8, StructureType.Bank)],
      firstGlobalStructure: structure(99, 5, 5),
    });

    expect(selected).toEqual({
      selectedStructure: { entity_id: 33, coord_x: 3, coord_y: 4 },
      spectator: false,
    });
  });

  it("uses first global structure in spectator mode when no owned structures are available", () => {
    const selected = resolve({
      ownedStructures: [],
      firstGlobalStructure: structure(77, 12, 18, StructureType.FragmentMine),
    });

    expect(selected).toEqual({
      selectedStructure: { entity_id: 77, coord_x: 12, coord_y: 18 },
      spectator: true,
    });
  });

  it("returns no selection in spectator mode when neither owned nor global structures are available", () => {
    const selected = resolve({
      ownedStructures: [],
      firstGlobalStructure: null,
    });

    expect(selected).toEqual({
      selectedStructure: null,
      spectator: true,
    });
  });
});
