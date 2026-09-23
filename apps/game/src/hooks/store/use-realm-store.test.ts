// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { configManager } from "@bibliothecadao/eternum";
import type { Structure } from "@bibliothecadao/types";
import type { RealmStore } from "./use-realm-store";

const ownedStructures = vi.hoisted(() => ({ current: [] as Structure[] }));
vi.mock("@/sync/fact-views", () => ({ readActivePlayerStructures: () => ownedStructures.current }));

vi.mock("@bibliothecadao/types", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bibliothecadao/types")>();
  return {
    ...actual,
    StructureType: {
      Realm: 1,
      Village: 2,
      Bank: 3,
      Mine: 4,
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
  Mine: 4,
} as const;

const { createRealmStoreSlice } = await import("./use-realm-store");

vi.spyOn(configManager, "getMapCenter").mockReturnValue(2010831280);

type RealmStoreState = RealmStore;

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
  }) as unknown as Structure;

describe("use-realm-store spectator lifecycle", () => {
  it("enters spectator mode while preserving last controlled owned structure", () => {
    const harness = createRealmStoreTestHarness();
    harness.setState({
      structureEntityId: 101,
      isSpectating: false,
    });
    ownedStructures.current = [makeStructure(101), makeStructure(202)];

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
    });
    ownedStructures.current = [makeStructure(101), makeStructure(202)];

    harness.getState().setStructureEntityId(303, {
      spectator: true,
      worldMapPosition: { col: 2010831286, row: 2010831278 },
    });

    const next = harness.getState();
    expect(next.worldMapReturnPosition).toEqual({ col: 6, row: -2 });
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
