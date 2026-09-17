import { feltEquals, fetchHeraldGameSnapshot, snapshotModelRows } from "@bibliothecadao/eternum/game-client";
import type { WorldDeployment } from "./world-directory";

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

interface StructureLocation {
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

interface HeraldPreSessionReader {
  fetchAddressName: (address: string) => Promise<unknown | null>;
  fetchPlayerStructures: (owner: string) => Promise<PlayerStructure[]>;
  fetchRealmSettlements: () => Promise<StructureLocation[]>;
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

export const createHeraldPreSessionReader = (world: WorldDeployment, gameId: number): HeraldPreSessionReader => ({
  fetchAddressName: async (address) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["AddressName"]);
    return snapshotModelRows(snapshot, "AddressName").find((row) => feltEquals(row.address, address))?.name ?? null;
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

  fetchSettlementSnapshot: async (player) => {
    const snapshot = await fetchHeraldGameSnapshot(world, gameId, ["PlayerEntry", "Structure"]);
    const settlement = snapshotModelRows(snapshot, "PlayerEntry").find((row) => feltEquals(row.player, player));
    const ownedStructureCount = snapshotModelRows(snapshot, "Structure").filter((row) =>
      feltEquals(row.owner, player),
    ).length;
    return {
      hasSettlementRecord: settlement !== undefined,
      hasSettledStructure: ownedStructureCount > 0,
      settledCount: ownedStructureCount,
    };
  },
});
