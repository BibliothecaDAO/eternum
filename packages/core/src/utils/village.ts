import {
  Direction,
  getNeighborHexes,
  ID,
  Steps
} from "@bibliothecadao/types";
import { Clause, Query, ToriiClient } from "@dojoengine/torii-wasm";

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

// Main functions
export const getRandomRealmWithVillageSlotsFromTorii = async (toriiClient: ToriiClient) => {
  const villageSlots = await toriiClient.getEntities(createStructureVillageSlotsQuery(), false);
  const entityId = Object.keys(villageSlots)[0];
  
  if (!entityId) return null;

  const villageSlotsData = villageSlots[entityId]["s1_eternum-StructureVillageSlots"] as any;
  const availableSlots = villageSlotsData.directions_left.value.map((v: any) => v.value.option);
  
  return {
    realmId: villageSlotsData.connected_realm_id?.value,
    entityId: Number(villageSlotsData.connected_realm_entity_id?.value),
    hasSlots: true,
    availableSlots: formatVillageSlots(
      availableSlots,
      villageSlotsData.connected_realm_coord?.value.x.value,
      villageSlotsData.connected_realm_coord?.value.y.value
    ),
    position: {
      col: villageSlotsData.connected_realm_coord?.value.x.value,
      row: villageSlotsData.connected_realm_coord?.value.y.value
    }
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
  const entity = Object.keys(villageSlots)[0];
  
  if (!entity) return null;

  const villageSlotsData = villageSlots[entity]["s1_eternum-StructureVillageSlots"] as any;
  const availableSlots = villageSlotsData.directions_left.value.map(
    (v: any) => v.value.option
  );

  return {
    realmId: villageSlotsData.connected_realm_id?.value,
    entityId: Number(villageSlotsData.connected_realm_entity_id?.value),
    hasSlots: true,
    availableSlots: formatVillageSlots(
      availableSlots,
      villageSlotsData.connected_realm_coord?.value.x.value,
      villageSlotsData.connected_realm_coord?.value.y.value
    ),
    position: {
      col: villageSlotsData.connected_realm_coord?.value.x.value,
      row: villageSlotsData.connected_realm_coord?.value.y.value
    }
  };
};
