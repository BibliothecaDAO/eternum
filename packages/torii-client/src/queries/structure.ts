import { Direction, getNeighborHexes, ID, Steps } from "@bibliothecadao/types";
// import { Entity } from "@dojoengine/recs"; // Will be removed
import { Clause, PatternMatching, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getStructureFromToriiEntity } from "../parser";
import { getResourcesFromToriiEntity } from "../parser/resources";

export const getFirstStructureFromToriiClient = async (toriiClient: ToriiClient, ownedBy?: string) => {
  const clause: Clause = !ownedBy
    ? {
        Keys: {
          keys: [undefined],
          pattern_matching: "FixedLen" as PatternMatching,
          models: ["s1_eternum-Structure"],
        },
      }
    : {
        Composite: {
          operator: "And",
          clauses: [
            {
              Keys: {
                keys: [undefined],
                pattern_matching: "FixedLen" as PatternMatching,
                models: ["s1_eternum-Structure"],
              },
            },
            {
              Member: {
                model: "s1_eternum-Structure",
                member: "owner",
                operator: "Eq",
                value: { Primitive: { ContractAddress: ownedBy } },
              },
            },
          ],
        },
      };

  const query: Query = {
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models: ["s1_eternum-Structure"],
    historical: false,
    clause,
  };

  const response = await toriiClient.getEntities(query);

  const entityModels = response.items[0].models;
  const structureData = entityModels["s1_eternum-Structure"];

  const structure = getStructureFromToriiEntity(structureData);
  return {
    entityId: structure.entity_id,
    owner: structure.owner,
    position: { col: structure.base.coord_x, row: structure.base.coord_y },
  };
};

export const getStructureFromToriiClient = async (toriiClient: ToriiClient, entityId: ID) => {
  const query: Query = {
    pagination: {
      limit: 1,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models: ["s1_eternum-Structure", "s1_eternum-Resource"],
    historical: false,
    clause: {
      Keys: {
        keys: [entityId.toString()],
        pattern_matching: "FixedLen" as PatternMatching,
        models: ["s1_eternum-Structure", "s1_eternum-Resource"], // Ensure models list here matches top-level if keys are specific to them
      },
    },
  };

  const response = await toriiClient.getEntities(query);

  const entityModels = response.items[0].models;
  const structureData = entityModels["s1_eternum-Structure"];
  const resourceData = entityModels["s1_eternum-Resource"];

  return {
    structure: getStructureFromToriiEntity(structureData),
    resources: getResourcesFromToriiEntity(resourceData),
  };
};

export const getAllStructuresFromToriiClient = async (toriiClient: ToriiClient, ownedBy?: string) => {
  const clause: Clause = !ownedBy
    ? {
        Keys: {
          keys: [undefined],
          pattern_matching: "FixedLen" as PatternMatching,
          models: ["s1_eternum-Structure"],
        },
      }
    : {
        Member: {
          model: "s1_eternum-Structure",
          member: "owner",
          operator: "Eq",
          value: { Primitive: { ContractAddress: ownedBy } },
        },
      };

  const query: Query = {
    pagination: {
      limit: 1000,
      cursor: undefined,
      direction: "Forward",
      order_by: [],
    },
    no_hashed_keys: false,
    models: ["s1_eternum-Structure"],
    historical: false,
    clause,
  };

  const response = await toriiClient.getEntities(query);

  const result =
    response && response.items
      ? response.items
          .map((item) => {
            if (item.models && item.models["s1_eternum-Structure"]) {
              const structure = getStructureFromToriiEntity(item.models["s1_eternum-Structure"]);
              return {
                entityId: structure.entity_id,
                owner: structure.owner,
                position: { col: structure.base.coord_x, row: structure.base.coord_y },
              };
            }
            return null; // Or handle as needed if a structure model is missing
          })
          .filter((item) => item !== null)
      : []; // Filter out nulls if any item didn't have the structure model

  return result;
};

// Types For Getting Village Slots
interface VillageSlot {
  value: Direction;
  label: string;
  coord: {
    col: number;
    row: number;
  };
}

interface VillageSlotCheckResult {
  realmId: number;
  entityId: number;
  hasSlots: boolean;
  availableSlots: VillageSlot[];
  position: {
    col: number;
    row: number;
  };
}

// Constants
const DIRECTION_MAP: Record<string, Direction> = {
  East: Direction.EAST,
  NorthEast: Direction.NORTH_EAST,
  NorthWest: Direction.NORTH_WEST,
  West: Direction.WEST,
  SouthWest: Direction.SOUTH_WEST,
  SouthEast: Direction.SOUTH_EAST,
};

// Helper functions
const convertDirectionsToEnum = (directions: string[]): Direction[] =>
  directions.map((direction) => DIRECTION_MAP[direction]).filter((dir): dir is Direction => dir !== undefined);

const formatVillageSlots = (availableSlotStrings: string[], col: number, row: number): VillageSlot[] => {
  const availableSlots = convertDirectionsToEnum(availableSlotStrings);
  const neighborHexes = getNeighborHexes(col, row, Steps.Two);

  return neighborHexes
    .filter((neighbor) => availableSlots.includes(neighbor.direction))
    .map((neighbor) => ({
      value: neighbor.direction,
      label: Direction[neighbor.direction].replace(/_/g, " "),
      coord: {
        col: neighbor?.col ?? 0,
        row: neighbor?.row ?? 0,
      },
    }));
};

// Query builders
const createStructureVillageSlotsQuery = (clause?: Clause): Query => ({
  pagination: {
    limit: 1,
    cursor: undefined,
    direction: "Forward",
    order_by: [],
  },
  no_hashed_keys: false,
  models: ["s1_eternum-StructureVillageSlots"],
  historical: false,
  clause,
});

// Main functions
export const getRandomRealmWithVillageSlotsFromTorii = async (toriiClient: ToriiClient) => {
  const response = await toriiClient.getEntities(createStructureVillageSlotsQuery());

  const entityModels = response.items[0].models;
  const villageSlotsData = entityModels["s1_eternum-StructureVillageSlots"] as any; // Keep as any for now due to complex structure

  if (!villageSlotsData) return null;

  const availableSlots = villageSlotsData.directions_left.value.map((v: any) => v.value.option);

  return {
    realmId: villageSlotsData.connected_realm_id?.value,
    entityId: Number(villageSlotsData.connected_realm_entity_id?.value),
    hasSlots: true,
    availableSlots: formatVillageSlots(
      availableSlots,
      villageSlotsData.connected_realm_coord?.value.x.value,
      villageSlotsData.connected_realm_coord?.value.y.value,
    ),
    position: {
      col: villageSlotsData.connected_realm_coord?.value.x.value,
      row: villageSlotsData.connected_realm_coord?.value.y.value,
    },
  };
};

export const checkOpenVillageSlotFromToriiClient = async (
  toriiClient: ToriiClient,
  realmId: ID,
): Promise<VillageSlotCheckResult | null> => {
  const villageSlotQuery = createStructureVillageSlotsQuery({
    Member: {
      model: "s1_eternum-StructureVillageSlots",
      member: "connected_realm_id",
      operator: "Eq",
      value: { Primitive: { U16: realmId } },
    },
  });

  const response = await toriiClient.getEntities(villageSlotQuery);

  const entityModels = response.items[0].models;
  const villageSlotsData = entityModels["s1_eternum-StructureVillageSlots"] as any; // Keep as any

  if (!villageSlotsData) return null;

  const availableSlots = villageSlotsData.directions_left.value.map((v: any) => v.value.option);

  return {
    realmId: villageSlotsData.connected_realm_id?.value,
    entityId: Number(villageSlotsData.connected_realm_entity_id?.value),
    hasSlots: true,
    availableSlots: formatVillageSlots(
      availableSlots,
      villageSlotsData.connected_realm_coord?.value.x.value,
      villageSlotsData.connected_realm_coord?.value.y.value,
    ),
    position: {
      col: villageSlotsData.connected_realm_coord?.value.x.value,
      row: villageSlotsData.connected_realm_coord?.value.y.value,
    },
  };
};

export const hasSurroundingWonderFromToriiClient = async (
  toriiClient: ToriiClient,
  coords: { col: number; row: number },
) => {
  const radius = 200;

  const query: Query = {
    limit: 1000,
    offset: 0,
    dont_include_hashed_keys: false,
    order_by: [],
    entity_models: ["s1_eternum-Structure"],
    entity_updated_after: 0,
    clause: AndComposeClause([
      MemberClause("s1_eternum-Structure", "base.coord_x", "Gte", coords.col - radius),
      MemberClause("s1_eternum-Structure", "base.coord_x", "Lte", coords.col + radius),
      MemberClause("s1_eternum-Structure", "base.coord_y", "Gte", coords.row - radius),
      MemberClause("s1_eternum-Structure", "base.coord_y", "Lte", coords.row + radius),
      MemberClause("s1_eternum-Structure", "metadata.has_wonder", "Eq", true),
    ]).build(),
  };
  const wonders = await toriiClient.getEntities(query, false);
  return !!Object.keys(wonders).length;
};
