import {
  Direction,
  getNeighborHexes,
  ID,
  Steps
} from "@bibliothecadao/types";
import { Clause, Query, ToriiClient } from "@dojoengine/torii-wasm";
import { getStructureFromToriiEntity } from "./structure";

// Types
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
  "East": Direction.EAST,
  "NorthEast": Direction.NORTH_EAST,
  "NorthWest": Direction.NORTH_WEST,
  "West": Direction.WEST,
  "SouthWest": Direction.SOUTH_WEST,
  "SouthEast": Direction.SOUTH_EAST
};

// Helper functions
const convertDirectionsToEnum = (directions: string[]): Direction[] => 
  directions
    .map(direction => DIRECTION_MAP[direction])
    .filter((dir): dir is Direction => dir !== undefined);

const formatVillageSlots = (
  availableSlotStrings: string[], 
  col: number,  
  row: number
): VillageSlot[] => {
  const availableSlots = convertDirectionsToEnum(availableSlotStrings);
  const neighborHexes = getNeighborHexes(col, row, Steps.Two);
  
  return neighborHexes
    .filter(neighbor => availableSlots.includes(neighbor.direction))
    .map(neighbor => ({
      value: neighbor.direction,
      label: Direction[neighbor.direction].replace(/_/g, " "),
      coord: {
        col: neighbor?.col ?? 0,
        row: neighbor?.row ?? 0,
      }
    }));
};

// Query builders
const createStructureVillageSlotsQuery = (clause?: Clause): Query => ({
  limit: 1,
  offset: 0,
  clause,
  dont_include_hashed_keys: false,
  order_by: [],
  entity_models: ["s1_eternum-StructureVillageSlots"],
  entity_updated_after: 0
});

const createStructureQuery = (entityId: number): Query => ({
  limit: 1,
  offset: 0,
  clause: {
    Member: {
      model: "s1_eternum-Structure",
      member: "entity_id",
      operator: "Eq",
      value: { Primitive: { U32: entityId } }
    }
  },
  dont_include_hashed_keys: false,
  order_by: [],
  entity_models: ["s1_eternum-Structure"],
  entity_updated_after: 0
});

// Main functions
export const getRandomRealmWithVillageSlotsFromTorii = async (toriiClient: ToriiClient) => {
  const villageSlots = await toriiClient.getEntities(createStructureVillageSlotsQuery(), false);
  const entityId = Object.keys(villageSlots)[0];
  
  if (!entityId) return null;

  const villageSlotsData = villageSlots[entityId]["s1_eternum-StructureVillageSlots"] as any;
  const availableSlots = villageSlotsData.directions_left.value.map((v: any) => v.value.option);
  
  const structureEntities = await toriiClient.getEntities(
    createStructureQuery(villageSlotsData.connected_realm_entity_id?.value),
    false
  );
  
  const structure = getStructureFromToriiEntity(structureEntities[entityId]["s1_eternum-Structure"]);
  
  return {
    structure,
    availableSlots: formatVillageSlots(
      availableSlots,
      structure.base.coord_x,
      structure.base.coord_y
    )
  };
};

export const checkOpenVillageSlotFromToriiClient = async (
  toriiClient: ToriiClient,
  realmId: ID
): Promise<VillageSlotCheckResult | null> => {
  const villageSlotQuery = createStructureVillageSlotsQuery({
    Member: {
      model: "s1_eternum-StructureVillageSlots",
      member: "connected_realm_id",
      operator: "Eq",
      value: { Primitive: { U16: realmId } }
    }
  });

  const villageSlots = await toriiClient.getEntities(villageSlotQuery, false);
  const realmEntityId = Object.keys(villageSlots)[0];
  
  if (!realmEntityId) return null;

  const villageSlotsData = villageSlots[realmEntityId]["s1_eternum-StructureVillageSlots"] as any;
  const structureEntities = await toriiClient.getEntities(
    createStructureQuery(villageSlotsData.connected_realm_entity_id?.value),
    false
  );

  const structure = getStructureFromToriiEntity(
    structureEntities[realmEntityId]["s1_eternum-Structure"]
  );
  
  const availableSlots = villageSlotsData.directions_left.value.map(
    (v: any) => v.value.option
  );

  return {
    realmId: structure.metadata.realm_id,
    entityId: structure.entity_id,
    hasSlots: true,
    availableSlots: formatVillageSlots(
      availableSlots,
      structure.base.coord_x,
      structure.base.coord_y
    ),
    position: {
      col: structure.base.coord_x,
      row: structure.base.coord_y
    }
  };
};
