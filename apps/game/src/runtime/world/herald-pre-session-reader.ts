import { tileDataToTile } from "@bibliothecadao/types";

import { feltEquals, fetchHeraldGameSnapshot, snapshotModelRows } from "./herald-http";
import type { WorldDeployment } from "./world-directory";

type DirectionString = "East" | "NorthEast" | "NorthWest" | "West" | "SouthWest" | "SouthEast";
export type DirectionSlots = Array<Partial<Record<DirectionString, []>>>;

export interface PlayerStructure {
  category: number;
  coord_x: number;
  coord_y: number;
  entity_id: number;
  has_wonder: boolean | null;
  level: number;
  realm_id: number | null;
  resources_packed: string;
}

export interface RealmVillageSlot {
  connected_realm_coord: { col: number; row: number };
  connected_realm_entity_id: number;
  connected_realm_id: number;
  directions_left: DirectionSlots;
}

export interface SettlementPlannerRealm {
  coordX: number;
  coordY: number;
  directionsLeft: DirectionSlots;
  entityId: number;
  ownerAddress: string;
  ownerName: string | null;
  realmId: number | null;
  villagesCount: number;
}

export interface SettlementPlannerVillage {
  coordX: number;
  coordY: number;
  entityId: number;
}

export interface SettlementPlannerSnapshot {
  realms: SettlementPlannerRealm[];
  villages: SettlementPlannerVillage[];
}

export interface SettlementPlannerTile {
  alt: boolean;
  biome: number;
  coordX: number;
  coordY: number;
}

export interface ExploredTileBounds {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
}

export interface StructureLocation {
  coord_x: number;
  coord_y: number;
  entity_id: number;
  owner: string;
}

export interface SettlementSnapshot {
  hasSettlementRecord: boolean;
  hasSettledStructure: boolean;
  settledCount: number;
}

export interface HeraldPreSessionReader {
  fetchAddressName: (address: string) => Promise<unknown | null>;
  fetchExploredTilesInBounds: (bounds: ExploredTileBounds) => Promise<SettlementPlannerTile[]>;
  fetchPlayerStructures: (owner: string) => Promise<PlayerStructure[]>;
  fetchRealmSettlements: () => Promise<StructureLocation[]>;
  fetchRealmVillageSlots: () => Promise<RealmVillageSlot[]>;
  fetchSettlementPlannerSnapshot: () => Promise<SettlementPlannerSnapshot>;
  fetchSettlementSnapshot: (player: string) => Promise<SettlementSnapshot>;
}

const toNumber = (value: unknown, field: string): number => {
  try {
    const number = Number(BigInt(value as string | number | bigint));
    if (Number.isSafeInteger(number)) return number;
  } catch {
    // Use the field-specific failure below.
  }
  throw new Error(`Herald pre-session reader expected ${field} to be a safe integer`);
};

const toRecord = (value: unknown, field: string): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Herald pre-session reader expected ${field} to be an object`);
  }
  return value as Record<string, unknown>;
};

const toAddress = (value: unknown): string => `0x${BigInt(value as string | number | bigint).toString(16)}`;

const toDirectionSlots = (value: unknown): DirectionSlots => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (typeof entry === "string") return [{ [entry]: [] } as Partial<Record<DirectionString, []>>];
    if (typeof entry === "object" && entry !== null) return [entry as Partial<Record<DirectionString, []>>];
    return [];
  });
};

const structureDetails = (row: Record<string, unknown>) => {
  const base = toRecord(row.base, "Structure.base");
  const metadata = toRecord(row.metadata, "Structure.metadata");
  return { base, metadata };
};

const structureCategory = (row: Record<string, unknown>): number => {
  const { base } = structureDetails(row);
  return toNumber(base.category, "Structure.base.category");
};

const toPlayerStructure = (row: Record<string, unknown>): PlayerStructure => {
  const { base, metadata } = structureDetails(row);
  return {
    category: structureCategory(row),
    coord_x: toNumber(base.coord_x, "Structure.base.coord_x"),
    coord_y: toNumber(base.coord_y, "Structure.base.coord_y"),
    entity_id: toNumber(row.entity_id, "Structure.entity_id"),
    has_wonder: typeof metadata.has_wonder === "boolean" ? metadata.has_wonder : null,
    level: toNumber(base.level, "Structure.base.level"),
    realm_id: metadata.realm_id == null ? null : toNumber(metadata.realm_id, "Structure.metadata.realm_id"),
    resources_packed: String(row.resources_packed),
  };
};

const toStructureLocation = (row: Record<string, unknown>): StructureLocation => {
  const { base } = structureDetails(row);
  return {
    coord_x: toNumber(base.coord_x, "Structure.base.coord_x"),
    coord_y: toNumber(base.coord_y, "Structure.base.coord_y"),
    entity_id: toNumber(row.entity_id, "Structure.entity_id"),
    owner: toAddress(row.owner),
  };
};

const toVillageSlot = (row: Record<string, unknown>): RealmVillageSlot => {
  const coord = toRecord(row.connected_realm_coord, "StructureVillageSlots.connected_realm_coord");
  return {
    connected_realm_coord: {
      col: toNumber(coord.x, "StructureVillageSlots.connected_realm_coord.x"),
      row: toNumber(coord.y, "StructureVillageSlots.connected_realm_coord.y"),
    },
    connected_realm_entity_id: toNumber(
      row.connected_realm_entity_id,
      "StructureVillageSlots.connected_realm_entity_id",
    ),
    connected_realm_id: toNumber(row.connected_realm_id, "StructureVillageSlots.connected_realm_id"),
    directions_left: toDirectionSlots(row.directions_left),
  };
};

const ownerNames = (rows: Record<string, unknown>[]): Map<string, string> =>
  new Map(
    rows.flatMap((row) => {
      if (row.address == null || row.name == null || BigInt(row.name as string) === 0n) return [];
      const encoded = BigInt(row.name as string).toString(16);
      const padded = encoded.length % 2 === 0 ? encoded : `0${encoded}`;
      const bytes = padded.match(/.{2}/g) ?? [];
      return [[toAddress(row.address), String.fromCharCode(...bytes.map((byte) => Number.parseInt(byte, 16)))]];
    }),
  );

export const createHeraldPreSessionReader = (world: WorldDeployment, gameId: number): HeraldPreSessionReader => ({
  fetchAddressName: async (address) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["AddressName"]);
    return snapshotModelRows(snapshot, "AddressName").find((row) => feltEquals(row.address, address))?.name ?? null;
  },

  fetchExploredTilesInBounds: async (bounds) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["TileOpt"]);
    return snapshotModelRows(snapshot, "TileOpt")
      .map((row) => tileDataToTile(row.data as string))
      .filter(
        (tile) =>
          !tile.alt &&
          tile.biome !== 0 &&
          tile.col >= bounds.minX &&
          tile.col <= bounds.maxX &&
          tile.row >= bounds.minY &&
          tile.row <= bounds.maxY,
      )
      .map((tile) => ({ alt: tile.alt, biome: tile.biome, coordX: tile.col, coordY: tile.row }));
  },

  fetchPlayerStructures: async (owner) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["Structure"]);
    return snapshotModelRows(snapshot, "Structure")
      .filter((row) => feltEquals(row.owner, owner))
      .map(toPlayerStructure)
      .sort((left, right) => left.category - right.category || left.entity_id - right.entity_id);
  },

  fetchRealmSettlements: async () => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["Structure"]);
    return snapshotModelRows(snapshot, "Structure")
      .filter((row) => structureCategory(row) === 1)
      .map(toStructureLocation);
  },

  fetchRealmVillageSlots: async () => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["StructureVillageSlots"]);
    return snapshotModelRows(snapshot, "StructureVillageSlots").map(toVillageSlot);
  },

  fetchSettlementPlannerSnapshot: async () => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, [
      "AddressName",
      "Structure",
      "StructureVillageSlots",
    ]);
    const names = ownerNames(snapshotModelRows(snapshot, "AddressName"));
    const slots = new Map(
      snapshotModelRows(snapshot, "StructureVillageSlots").map((row) => {
        const slot = toVillageSlot(row);
        return [slot.connected_realm_entity_id, slot.directions_left];
      }),
    );
    const structures = snapshotModelRows(snapshot, "Structure");
    return {
      realms: structures
        .filter((row) => structureCategory(row) === 1)
        .map((row): SettlementPlannerRealm => {
          const location = toStructureLocation(row);
          const { metadata } = structureDetails(row);
          return {
            coordX: location.coord_x,
            coordY: location.coord_y,
            directionsLeft: slots.get(location.entity_id) ?? [],
            entityId: location.entity_id,
            ownerAddress: location.owner,
            ownerName: names.get(location.owner) ?? null,
            realmId: metadata.realm_id == null ? null : toNumber(metadata.realm_id, "Structure.metadata.realm_id"),
            villagesCount: toNumber(metadata.villages_count ?? 0, "Structure.metadata.villages_count"),
          };
        }),
      villages: structures
        .filter((row) => structureCategory(row) === 5)
        .map((row): SettlementPlannerVillage => {
          const location = toStructureLocation(row);
          return { coordX: location.coord_x, coordY: location.coord_y, entityId: location.entity_id };
        }),
    };
  },

  fetchSettlementSnapshot: async (player) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["BlitzSettlement", "Structure"]);
    const settlement = snapshotModelRows(snapshot, "BlitzSettlement").find((row) => feltEquals(row.player, player));
    const ownedStructureCount = snapshotModelRows(snapshot, "Structure").filter((row) =>
      feltEquals(row.owner, player),
    ).length;
    const structureIds = settlement?.structure_ids;
    const settledCount = Array.isArray(structureIds) ? structureIds.length : ownedStructureCount;
    return {
      hasSettlementRecord: settlement !== undefined,
      hasSettledStructure: ownedStructureCount > 0,
      settledCount: Math.max(settledCount, ownedStructureCount),
    };
  },
});
