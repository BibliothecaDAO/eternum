import type {
  ArmyMapDataRaw,
  BattleLogEvent,
  PlayerRelicsData,
  PlayerStructure,
  StructureMapDataRaw,
  TradeEvent,
} from "@bibliothecadao/torii";
import type { StructureType } from "@bibliothecadao/types";

export interface RealmSummary {
  entityId: number;
  realmId: number | null;
  ownerAddress: string;
  ownerName?: string | null;
  level: number;
  structureType: StructureType;
  coord: { x: number; y: number };
  resourcesPacked: string;
  raw: StructureMapDataRaw;
}

export interface ArmySummary {
  entityId: number;
  coord: { x: number; y: number };
  ownerAddress?: string | null;
  ownerName?: string | null;
  troopCategory?: string | null;
  troopTier?: string | null;
  troopCount: bigint;
  staminaAmount?: bigint | null;
  battleCooldownEnd?: number | null;
  raw: ArmyMapDataRaw;
}

export interface TileSummary {
  coord: { x: number; y: number };
  biome: number;
  occupierId: number;
  occupierType: number;
  occupierIsStructure: boolean;
}

export interface MarketSwapSummary {
  takerId: number;
  takerAddress: string;
  makerId: number;
  makerAddress: string;
  resourceGivenId: number;
  resourceGivenAmount: number;
  resourceTakenId: number;
  resourceTakenAmount: number;
  timestamp: number;
  raw: TradeEvent;
}

export interface PlayerProfile {
  ownerAddress: string;
  structures: PlayerStructure[];
  relics: PlayerRelicsData;
  stats?: {
    realms: number;
    hyperstructures: number;
    banks: number;
    mines: number;
    villages: number;
    explorerCount: number;
    guildId?: string | null;
    guildName?: string | null;
    playerName?: string | null;
  };
}

export interface BattleLogSummary {
  attackerId: number;
  defenderId: number;
  attackerOwnerId: number;
  defenderOwnerId: number | null;
  winnerId: number | null;
  maxReward: number;
  success: number | null;
  timestamp: number;
  raw: BattleLogEvent;
}
