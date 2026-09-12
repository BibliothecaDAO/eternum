// @vitest-environment node

import {
  BUILDINGS_CENTER,
  BuildingType,
  type ClientComponents,
  createClientComponents,
  defineContractComponents,
  getNeighborHexes,
  type SystemCalls,
} from "@bibliothecadao/types";
import { type Component, type ComponentValue, createWorld, type Schema, setComponent, Type } from "@dojoengine/recs";
import type { AccountInterface } from "starknet";
import { afterEach, describe, expect, it, vi } from "vitest";

// Through the barrel, as the app loads core: the managers resolve their cross-imports off it.
import {
  ActionType,
  ArmyActionManager,
  ClientConfigManager,
  createGameActions,
  createGameViews,
  gameEntityKey,
} from "../../index";
import type { GameClient } from "../game-client";

const GAME_ID = 28;
const EXPLORER_ID = 101;
const STRUCTURE_ID = 12;
const SIGNER = { address: "0xabc" } as AccountInterface;

afterEach(() => {
  ClientConfigManager.instance().setActiveGame(0, 0);
});

describe("game actions", () => {
  it("moveArmy dispatches the same explorer_travel call the manager does", async () => {
    const { components, systemCalls, client } = createHarness(SIGNER);
    const path = seedExplorerWithTravelPath(components);

    await client.actions.moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 });
    await new ArmyActionManager(components, systemCalls, EXPLORER_ID).moveArmy(SIGNER, path, true, 7);

    expect(systemCalls.explorer_travel).toHaveBeenCalledTimes(2);
    const [throughActions, throughManager] = vi.mocked(systemCalls.explorer_travel).mock.calls;
    expect(throughActions).toEqual(throughManager);
    expect(throughActions?.[0]).toEqual({ signer: SIGNER, explorer_id: EXPLORER_ID, directions: [expect.any(Number)] });
  });

  it("placeBuilding submits for the structure's own hex", async () => {
    const { components, systemCalls, client } = createHarness(SIGNER);
    seedStructure(components, { x: 40, y: 50 });
    const hex = { col: BUILDINGS_CENTER[0] + 1, row: BUILDINGS_CENTER[1] };

    await client.actions.placeBuilding({
      structureId: STRUCTURE_ID,
      buildingType: BuildingType.ResourceWheat,
      hex,
      useSimpleCost: true,
    });

    expect(systemCalls.create_building).toHaveBeenCalledWith({
      signer: SIGNER,
      entity_id: STRUCTURE_ID,
      directions: [expect.any(Number)],
      building_category: BuildingType.ResourceWheat,
      use_simple: true,
    });
    expect(client.views.buildingTiles(STRUCTURE_ID).getHexCoords()).toEqual({ col: 40, row: 50 });
  });

  it("names a structure that is not in RECS instead of acting on a default hex", () => {
    const { client } = createHarness(SIGNER);

    expect(() => client.views.buildingTiles(STRUCTURE_ID)).toThrow("Structure 12 is not in RECS");
  });

  it("acts for a named signer over a client that never connected", async () => {
    const { components, systemCalls, client } = createHarness(null);
    const path = seedExplorerWithTravelPath(components);
    const bot = { address: "0xb07" } as AccountInterface;

    await createGameActions(client, { signer: bot }).moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 });

    expect(systemCalls.explorer_travel).toHaveBeenCalledWith(expect.objectContaining({ signer: bot }));
    expect(client.signer).toBeNull();
  });

  it("refuses to submit before connect(signer)", async () => {
    const { components, systemCalls, client } = createHarness(null);
    const path = seedExplorerWithTravelPath(components);

    await expect(client.actions.moveArmy({ explorerId: EXPLORER_ID, path, currentArmiesTick: 7 })).rejects.toThrow(
      "call client.connect(signer)",
    );
    expect(systemCalls.explorer_travel).not.toHaveBeenCalled();
  });
});

const createHarness = (signer: AccountInterface | null) => {
  ClientConfigManager.instance().setActiveGame(GAME_ID, 0);
  const components = createClientComponents({ contractComponents: defineContractComponents(createWorld(), "s2") });
  const systemCalls = {
    explorer_travel: vi.fn(async () => ({ transaction_hash: "0x1" })),
    create_building: vi.fn(async () => ({ transaction_hash: "0x2" })),
  } as unknown as SystemCalls;
  // createGameClient wires these the same way; the harness skips the network boot.
  const client = { setup: { components, systemCalls }, signer } as GameClient;
  Object.assign(client, { actions: createGameActions(client), views: createGameViews(client, 0n) });
  return { components, systemCalls, client };
};

/** An explorer at (20, 20) with one explored neighbor, and the two-step Move path to it. */
const seedExplorerWithTravelPath = (components: ClientComponents) => {
  const start = { col: 20, row: 20 };
  const destination = getNeighborHexes(start.col, start.row)[0];
  setComponent(
    components.ExplorerTroops,
    gameEntityKey([BigInt(EXPLORER_ID)]),
    rowOf(components.ExplorerTroops, {
      game_id: GAME_ID,
      explorer_id: EXPLORER_ID,
      owner: STRUCTURE_ID,
      troops: { count: 100n, stamina: { amount: 50n } },
      coord: { x: start.col, y: start.row, alt: false },
    }),
  );
  return [
    { hex: start, actionType: ActionType.Move },
    { hex: { col: destination.col, row: destination.row }, actionType: ActionType.Move },
  ];
};

const seedStructure = (components: ClientComponents, position: { x: number; y: number }) =>
  setComponent(
    components.Structure,
    gameEntityKey([BigInt(STRUCTURE_ID)]),
    rowOf(components.Structure, {
      game_id: GAME_ID,
      entity_id: STRUCTURE_ID,
      base: { coord_x: position.x, coord_y: position.y },
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
