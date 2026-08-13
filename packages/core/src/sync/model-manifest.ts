type GameSyncChannel = "global-entity" | "global-event" | "spatial-bootstrap" | "bounded-spatial" | "player-entity";

type GameSyncModelAvailability = "all" | "s2-only";
type GameSyncRecoveryPolicy = "snapshot" | "subscription-only" | "legacy-dual-channel" | "legacy-targeted";
type GameSyncDeletionPolicy = "component" | "event-retention";

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
  plannedEventRetention?: {
    retainRecsRows: false;
    dedupeIdentityLimit: number;
    replayEffectsOnRecovery: false;
  };
  /** S2 must adjudicate models currently delivered through both paths. */
  pendingChannelAdjudication?: boolean;
}

const EVENT_DEDUPE_IDENTITY_LIMIT = 512;

const plannedEventRetention = (): NonNullable<GameSyncModelDefinition["plannedEventRetention"]> => ({
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
  channels: ["global-entity"],
  availability: options.availability ?? "all",
  s2Scope: options.s2Scope ?? "game",
  legacyKeyCount: options.legacyKeyCount ?? 1,
  recovery: "snapshot",
  deletion: "component",
});

const globalEvent = (name: string): GameSyncModelDefinition => ({
  name,
  channels: ["global-event"],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: "subscription-only",
  deletion: "event-retention",
  plannedEventRetention: plannedEventRetention(),
});

const spatial = (
  name: string,
  colField: string,
  rowField: string,
  options: { bootstrap?: boolean; event?: boolean; player?: boolean } = {},
): GameSyncModelDefinition => ({
  name,
  channels: [
    ...(options.bootstrap === false ? [] : (["spatial-bootstrap"] as const)),
    "bounded-spatial",
    ...(options.event ? (["global-event"] as const) : []),
    ...(options.player ? (["player-entity"] as const) : []),
  ],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: options.event ? "legacy-dual-channel" : options.bootstrap === false ? "legacy-targeted" : "snapshot",
  deletion: options.event ? "event-retention" : "component",
  spatial: { colField, rowField },
  plannedEventRetention: options.event ? plannedEventRetention() : undefined,
  pendingChannelAdjudication: options.event,
});

const playerEntity = (name: string): GameSyncModelDefinition => ({
  name,
  channels: ["player-entity"],
  availability: "all",
  s2Scope: "game",
  legacyKeyCount: 1,
  recovery: "legacy-targeted",
  deletion: "component",
});

/**
 * Executable inventory of current S1 sync ownership. Selectors below are the
 * only source for subscription and snapshot model lists. S2 changes channel
 * assignments here when spatial truth becomes game-wide.
 */
export const GAME_SYNC_MODEL_MANIFEST: readonly GameSyncModelDefinition[] = [
  globalEntity("WorldConfig"),
  globalEntity("HyperstrtConstructConfig", { s2Scope: "chain" }),
  globalEntity("HyperstructureGlobals"),
  globalEntity("WeightConfig", { s2Scope: "chain" }),
  globalEntity("ResourceFactoryConfig", { s2Scope: "chain" }),
  globalEntity("BuildingCategoryConfig", { s2Scope: "chain" }),
  globalEntity("ResourceBridgeWtlConfig", { s2Scope: "chain" }),
  globalEntity("StructureLevelConfig", { s2Scope: "chain" }),
  globalEntity("SeasonPrize"),
  globalEntity("SeasonEnded"),
  globalEntity("QuestLevels"),
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
  spatial("ExplorerRewardEvent", "coord.x", "coord.y", { event: true }),
  spatial("BattleEvent", "coord.x", "coord.y", { event: true }),
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
