// @vitest-environment node

import {
  type ClientComponents,
  ContractAddress,
  createClientComponents,
  defineContractComponents,
  getNeighborHexes,
  StructureType,
} from "@bibliothecadao/types";
import { type Component, type ComponentValue, createWorld, type Schema, setComponent, Type } from "@dojoengine/recs";
import { afterEach, describe, expect, it } from "vitest";

// Through the barrel, as the app loads core: the utils resolve their cross-imports off it, and entering through a
// manager first would leave those exports partially forwarded under vitest.
import { ClientConfigManager, createGameViews, gameEntityKey, type GameViews } from "../../index";
import type { GameClient } from "../game-client";

const GAME_ID = 28;
const PLAYER = ContractAddress(0xabc);
const RIVAL = ContractAddress(0xdef);

afterEach(() => {
  ClientConfigManager.instance().setActiveGame(0, 0);
});

describe("game views", () => {
  it("lists a player's structures by category then entity id, seen as theirs", () => {
    const { components, views } = createHarness();
    seedStructure(components, { entityId: 30, owner: PLAYER, category: StructureType.Hyperstructure, x: 5, y: 5 });
    seedStructure(components, { entityId: 20, owner: PLAYER, category: StructureType.Realm, x: 3, y: 3 });
    seedStructure(components, { entityId: 7, owner: RIVAL, category: StructureType.Realm, x: 2, y: 2 });
    seedStructure(components, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 1, y: 1 });

    const structures = views.structures(PLAYER);

    expect(structures.map((structure) => structure.entityId)).toEqual([12, 20, 30]);
    expect(structures.every((structure) => structure.isMine)).toBe(true);
    expect(views.structures(RIVAL).map(({ entityId, isMine }) => ({ entityId, isMine }))).toEqual([
      { entityId: 7, isMine: false },
    ]);
    expect(views.allRealms().map((realm) => realm.entity_id)).toEqual([20, 7, 12]);
    expect(views.hyperstructureIds(PLAYER)).toEqual([30]);
  });

  it("reads a structure's explorers with stamina, home, and ownership relative to the viewer", () => {
    const { components, views } = createHarness();
    seedStructure(components, { entityId: 12, owner: PLAYER, category: StructureType.Realm, x: 10, y: 10 });
    const homeHex = getNeighborHexes(10, 10)[0];
    seedExplorer(components, { explorerId: 101, owner: 12, x: homeHex.col, y: homeHex.row, stamina: 40n });
    seedExplorer(components, { explorerId: 102, owner: 12, x: 50, y: 50, stamina: 5n });
    seedExplorer(components, { explorerId: 103, owner: 99, x: 60, y: 60, stamina: 0n });

    const explorers = views.explorers(12);

    expect(explorers.map(({ entityId, stamina, isHome, isMine }) => ({ entityId, stamina, isHome, isMine }))).toEqual([
      { entityId: 101, stamina: 40n, isHome: true, isMine: true },
      { entityId: 102, stamina: 5n, isHome: false, isMine: true },
    ]);
    expect(createGameViews(fakeClient(components), RIVAL).explorers(12)[0]?.isMine).toBe(false);
    expect(views.explorers(99).map((explorer) => explorer.entityId)).toEqual([103]);
    expect(views.explorers(1)).toEqual([]);
  });

  it("hands out a resource manager bound to the entity's Resource row in the active game", () => {
    const { components, views } = createHarness();
    setComponent(components.Resource, gameEntityKey([12n]), rowOf(components.Resource, { entity_id: 12 }));

    expect(views.resources(12).getResource()?.entity_id).toBe(12);
    expect(views.resources(13).getResource()).toBeUndefined();
  });
});

const createHarness = (): { components: ClientComponents; views: GameViews } => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 0);
  const components = createClientComponents({ contractComponents: defineContractComponents(createWorld(), "s2") });
  return { components, views: createGameViews(fakeClient(components), PLAYER) };
};

const fakeClient = (components: ClientComponents): GameClient => ({ setup: { components } }) as GameClient;

const seedStructure = (
  components: ClientComponents,
  input: { entityId: number; owner: ContractAddress; category: StructureType; x: number; y: number },
) =>
  setComponent(
    components.Structure,
    gameEntityKey([BigInt(input.entityId)]),
    rowOf(components.Structure, {
      game_id: GAME_ID,
      entity_id: input.entityId,
      owner: input.owner,
      category: input.category,
      base: { category: input.category, coord_x: input.x, coord_y: input.y },
    }),
  );

const seedExplorer = (
  components: ClientComponents,
  input: { explorerId: number; owner: number; x: number; y: number; stamina: bigint },
) =>
  setComponent(
    components.ExplorerTroops,
    gameEntityKey([BigInt(input.explorerId)]),
    rowOf(components.ExplorerTroops, {
      game_id: GAME_ID,
      explorer_id: input.explorerId,
      owner: input.owner,
      troops: { count: 100n, stamina: { amount: input.stamina } },
      coord: { x: input.x, y: input.y },
    }),
  );

type DeepPartial<T> = { [Key in keyof T]?: T[Key] extends object ? DeepPartial<T[Key]> : T[Key] };

/** A full row for a component: every field zeroed from the schema, with the fields under test overridden. */
const rowOf = <S extends Schema>(
  component: Component<S>,
  overrides: DeepPartial<ComponentValue<S>>,
): ComponentValue<S> => merge(zeroRow(component.schema), overrides) as ComponentValue<S>;

const zeroRow = (schema: Schema): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(schema).map(([key, type]) => [key, typeof type === "object" ? zeroRow(type) : zeroValue(type)]),
  );

const zeroValue = (type: Type): unknown => {
  switch (type) {
    case Type.Boolean:
      return false;
    case Type.BigInt:
      return 0n;
    case Type.String:
      return "";
    case Type.NumberArray:
      return [];
    default:
      return 0;
  }
};

const merge = (base: Record<string, unknown>, overrides: object): Record<string, unknown> => {
  const merged = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    merged[key] =
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? merge(base[key] as Record<string, unknown>, value)
        : value;
  }
  return merged;
};
