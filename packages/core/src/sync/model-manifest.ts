export type GameSyncChannel = "gamewide-entity" | "global-event";

export type GameSyncModelAvailability = "all" | "s2-only";
export type GameSyncRecoveryPolicy = "convergent-snapshot" | "event-deduped";
export type GameSyncDeletionPolicy = "component" | "event-ephemeral";

export interface GameSyncModelDefinition {
  name: string;
  channels: readonly GameSyncChannel[];
  availability: GameSyncModelAvailability;
  s2Scope: "game" | "chain";
  recovery: GameSyncRecoveryPolicy;
  deletion: GameSyncDeletionPolicy;
  spatial?: {
    colField: string;
    rowField: string;
  };
  eventRetention?: {
    retainRecsRows: false;
    dedupeIdentityLimit: number;
    replayEffectsOnRecovery: true;
  };
}

const EVENT_DEDUPE_IDENTITY_LIMIT = 512;

const eventRetention = (): NonNullable<GameSyncModelDefinition["eventRetention"]> => ({
  retainRecsRows: false,
  dedupeIdentityLimit: EVENT_DEDUPE_IDENTITY_LIMIT,
  replayEffectsOnRecovery: true,
});

const globalEntity = (
  name: string,
  options: {
    availability?: GameSyncModelAvailability;
    s2Scope?: "game" | "chain";
  } = {},
): GameSyncModelDefinition => ({
  name,
  channels: ["gamewide-entity"],
  availability: options.availability ?? "all",
  s2Scope: options.s2Scope ?? "game",
  recovery: "convergent-snapshot",
  deletion: "component",
});

const globalEvent = (name: string): GameSyncModelDefinition => ({
  name,
  channels: ["global-event"],
  availability: "all",
  s2Scope: "game",
  recovery: "event-deduped",
  deletion: "event-ephemeral",
  eventRetention: eventRetention(),
});

const spatial = (name: string, colField: string, rowField: string): GameSyncModelDefinition => ({
  name,
  channels: ["gamewide-entity"],
  availability: "all",
  s2Scope: "game",
  recovery: "convergent-snapshot",
  deletion: "component",
  spatial: { colField, rowField },
});

/**
 * Executable ownership map. The gamewide channel is authoritative for current
 * entity truth; event models remain ephemeral effects.
 */
export const GAME_SYNC_MODEL_MANIFEST: readonly GameSyncModelDefinition[] = [
  globalEntity("WorldConfig"),
  globalEntity("HyperstrtConstructConfig", { s2Scope: "chain" }),
  globalEntity("HyperstructureGlobals"),
  globalEntity("Hyperstructure"),
  // Live shareholder points read these rows; without a stream/snapshot channel
  // a mid-game hyperstructure claim never reaches RECS until a reload.
  globalEntity("HyperstructureShareholders"),
  globalEntity("WeightConfig", { s2Scope: "chain" }),
  globalEntity("ResourceFactoryConfig", { s2Scope: "chain" }),
  globalEntity("BuildingCategoryConfig", { s2Scope: "chain" }),
  globalEntity("ResourceBridgeWtlConfig", { s2Scope: "chain" }),
  globalEntity("StructureLevelConfig", { s2Scope: "chain" }),
  globalEntity("SeasonPrize"),
  globalEvent("SeasonEnded"),
  globalEntity("QuestLevels"),
  globalEntity("QuestTile"),
  globalEntity("AddressName", { s2Scope: "chain" }),
  globalEntity("PlayerRegisteredPoints"),
  globalEntity("BlitzSettlement"),
  globalEntity("BlitzEntryTokenRegister"),
  globalEntity("PlayersRankTrial"),
  globalEntity("PlayersRankFinal"),
  globalEntity("MMRGameMeta"),
  globalEntity("Guild"),
  globalEntity("GuildMember"),
  globalEntity("ResourceList", { s2Scope: "chain" }),
  globalEntity("PlayerRank"),
  globalEntity("RankPrize"),
  globalEntity("GuildWhitelist"),
  globalEntity("GameRegistry", { availability: "s2-only" }),
  // The s2 rulebook: config-manager reads every balance number (stamina, capacity, tick, combat...) from the
  // PresetConfig row the game points at, and chain-wide tuning from ChainConfig. Without them in the fold every
  // lookup returns the silent zero default (Aug 2026 human gate: no stamina bar, "need more capacity" at 6/12).
  globalEntity("ChainConfig", { availability: "s2-only", s2Scope: "chain" }),
  globalEntity("PresetConfig", { availability: "s2-only", s2Scope: "chain" }),
  globalEvent("OpenRelicChestEvent"),
  spatial("TileOpt", "col", "row"),
  spatial("Structure", "base.coord_x", "base.coord_y"),
  spatial("StructureBuildings", "coord.x", "coord.y"),
  spatial("Building", "outer_col", "outer_row"),
  spatial("ExplorerTroops", "coord.x", "coord.y"),
  globalEvent("ExplorerRewardEvent"),
  globalEvent("BattleEvent"),
  globalEvent("StoryEvent"),
  globalEntity("ProductionBoostBonus"),
  globalEntity("Resource"),
  globalEntity("ResourceArrival"),
];

export const getGameSyncModelsForChannel = (
  channel: GameSyncChannel,
  options: { includeS2Only?: boolean } = {},
): readonly GameSyncModelDefinition[] =>
  GAME_SYNC_MODEL_MANIFEST.filter(
    (model) => model.channels.includes(channel) && (options.includeS2Only === true || model.availability !== "s2-only"),
  );

export const findGameSyncModel = (name: string): GameSyncModelDefinition | undefined =>
  GAME_SYNC_MODEL_MANIFEST.find((candidate) => candidate.name === name);

export const getGameSyncModel = (name: string): GameSyncModelDefinition => {
  const model = findGameSyncModel(name);
  if (!model) {
    throw new Error(`Sync model ${name} is not classified in GAME_SYNC_MODEL_MANIFEST`);
  }
  return model;
};
