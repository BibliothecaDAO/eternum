type GameSyncChannel =
  | "gamewide-entity"
  | "global-entity"
  | "global-event"
  | "spatial-bootstrap"
  | "bounded-spatial"
  | "player-entity";

type GameSyncModelAvailability = "all" | "s2-only";
type GameSyncRecoveryPolicy = "convergent-snapshot" | "event-deduped";
type GameSyncDeletionPolicy = "component" | "event-ephemeral";

interface GameSyncModelDefinition {
  name: string;
  channels: readonly GameSyncChannel[];
  availability: GameSyncModelAvailability;
  s2Scope: "game" | "chain";
  legacyKeyCount: number;
  recovery: GameSyncRecoveryPolicy;
  deletion: GameSyncDeletionPolicy;
  spatial?: {
    colField: string;
    rowField: string;
  };
  eventRetention?: {
    retainRecsRows: false;
    dedupeIdentityLimit: number;
    replayEffectsOnRecovery: false;
  };
}

const EVENT_DEDUPE_IDENTITY_LIMIT = 512;

const eventRetention = (): NonNullable<GameSyncModelDefinition["eventRetention"]> => ({
  retainRecsRows: false,
  dedupeIdentityLimit: EVENT_DEDUPE_IDENTITY_LIMIT,
  replayEffectsOnRecovery: false,
});

const globalEntity = (
  name: string,
  options: {
    legacyKeyCount?: number;
    availability?: GameSyncModelAvailability;
    s2Scope?: "game" | "chain";
  } = {},
): GameSyncModelDefinition => ({
  name,
  channels: ["gamewide-entity", "global-entity"],
  availability: options.availability ?? "all",
  s2Scope: options.s2Scope ?? "game",
  legacyKeyCount: options.legacyKeyCount ?? 1,
  recovery: "convergent-snapshot",
  deletion: "component",
});

const globalEvent = (name: string): GameSyncModelDefinition => ({
  name,
  channels: ["global-event"],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: "event-deduped",
  deletion: "event-ephemeral",
  eventRetention: eventRetention(),
});

const spatial = (
  name: string,
  colField: string,
  rowField: string,
  options: { bootstrap?: boolean; player?: boolean } = {},
): GameSyncModelDefinition => ({
  name,
  channels: [
    "gamewide-entity",
    ...(options.bootstrap === false ? [] : (["spatial-bootstrap"] as const)),
    "bounded-spatial",
    ...(options.player ? (["player-entity"] as const) : []),
  ],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: "convergent-snapshot",
  deletion: "component",
  spatial: { colField, rowField },
});

const playerEntity = (name: string): GameSyncModelDefinition => ({
  name,
  channels: ["gamewide-entity", "player-entity"],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: "convergent-snapshot",
  deletion: "component",
});

/**
 * Executable S2 ownership map. The gamewide channel is authoritative; legacy
 * channel selectors remain only for the complete bounded rollback adapter and
 * are deleted with that adapter in S4.
 */
export const GAME_SYNC_MODEL_MANIFEST: readonly GameSyncModelDefinition[] = [
  globalEntity("WorldConfig"),
  globalEntity("HyperstrtConstructConfig", { s2Scope: "chain" }),
  globalEntity("HyperstructureGlobals"),
  globalEntity("Hyperstructure"),
  globalEntity("WeightConfig", { s2Scope: "chain" }),
  globalEntity("ResourceFactoryConfig", { s2Scope: "chain" }),
  globalEntity("BuildingCategoryConfig", { s2Scope: "chain" }),
  globalEntity("ResourceBridgeWtlConfig", { s2Scope: "chain" }),
  globalEntity("StructureLevelConfig", { s2Scope: "chain" }),
  globalEntity("SeasonPrize"),
  globalEntity("SeasonEnded"),
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
  globalEntity("ResourceList", { legacyKeyCount: 2, s2Scope: "chain" }),
  globalEntity("PlayerRank", { legacyKeyCount: 2 }),
  globalEntity("RankPrize", { legacyKeyCount: 2 }),
  globalEntity("GuildWhitelist", { legacyKeyCount: 2 }),
  globalEntity("GameRegistry", { availability: "s2-only" }),
  globalEvent("OpenRelicChestEvent"),
  spatial("TileOpt", "col", "row"),
  spatial("Structure", "base.coord_x", "base.coord_y", { bootstrap: false, player: true }),
  spatial("StructureBuildings", "coord.x", "coord.y", { player: true }),
  spatial("Building", "outer_col", "outer_row", { player: true }),
  spatial("ExplorerTroops", "coord.x", "coord.y"),
  globalEvent("ExplorerRewardEvent"),
  globalEvent("BattleEvent"),
  playerEntity("ProductionBoostBonus"),
  playerEntity("Resource"),
  playerEntity("ResourceArrival"),
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
