export type ID = number;
export type ContractAddress = string;

export interface Position {
  x: number;
  y: number;
}

export interface TileState {
  position: Position;
  biome: number;
  occupierId: ID;
  occupierType: number;
  occupierIsStructure: boolean;
  rewardExtracted: boolean;
}

/** Clean guard slot data — no hex strings, no nulls. */
export interface GuardInfo {
  slot: string;
  troopType: string;
  troopTier: string;
  count: number;
}

/** Resource with human-readable name and scaled amount. */
export interface ResourceInfo {
  name: string;
  amount: number;
}

/** Structure data returned by ViewClient.structureAt(). */
export interface StructureInfo {
  entityId: number;
  category: string;
  level: number;
  realmId: number;
  ownerAddress: string;
  position: Position;
  guards: GuardInfo[];
  resources: ResourceInfo[];
  explorerCount: number;
  maxExplorerCount: number;
}

/** Explorer data returned by ViewClient.explorerInfo(). */
export interface ExplorerInfo {
  entityId: number;
  ownerName: string | null;
  ownerAddress: string | null;
  troopType: string;
  troopTier: string;
  troopCount: number;
  stamina: number;
  staminaUpdatedTick: number;
  position: Position;
}
