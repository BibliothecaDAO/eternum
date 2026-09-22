/** Schema-derived classification shared by Herald and the client transport. */
export interface GameSyncModelDefinition {
  name: string;
  scope: "game" | "deployment";
  deletion: "component" | "event-ephemeral";
}

export interface GameSyncScope {
  actor?: string;
  expedition?: {
    epoch: number;
    spacing: number;
    owners: ReadonlySet<string>;
    realms: ReadonlySet<string>;
    entities: ReadonlySet<string>;
    productionSources: ReadonlySet<string>;
    realmTraits: ReadonlySet<string>;
    regions: ReadonlySet<string>;
  };
}

const actorModels = new Set(["ActionNonce", "ExecutionRecorded", "BatchProgress"]);
const sharedModels = new Set([
  "Preset",
  "GameSequence",
  "SpireLayout",
  "LedgerOperator",
  "CampResources",
  "ArtificerCost",
  "BlitzResult",
  "FaithRules",
  "SeasonWinThreshold",
  "ExtractionRewards",
  "RelicRules",
  "ChestRules",
  "RelicDiscovery",
  "DepositRules",
  "WithdrawalRules",
  "ResourceToken",
  "BankRules",
  "Market",
  "TradeRules",
  "BitcoinPhase",
  "MineKindConfig",
  "MinePool",
  "BlitzSettlementOrder",
  "BlitzRoster",
  "RealmCatalogue",
  "RealmGrants",
  "HyperstructureReservations",
  "SettlementRules",
  "SettlementProgress",
  "SettlementPool",
  "VillageRules",
  "VillagePool",
  "ProductionRecipe",
  "ProductionReady",
  "BoardRules",
  "BuildingRule",
  "BuildingRulesReady",
  "HyperstructureRules",
  "ResourceRule",
  "ResourceRulesReady",
  "UpgradeLimits",
  "UpgradeRecipe",
  "DepthRules",
  "GameRegistry",
  "SliceRules",
  "EntitySequence",
  "PointsTotal",
  "DomainState",
  "DomainClass",
  "Authentication",
  "OwnershipRulesReady",
]);

/** Actor changes replace these rows atomically while retaining shared game configuration. */
export function isScopedGameSyncModel(model: string, expedition: boolean): boolean {
  return actorModels.has(model) || (expedition && !sharedModels.has(model));
}

export function syncScalar(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint")
    throw new Error("Sync scope requires a scalar identity");
  return BigInt(value).toString();
}

export function gameSyncRegion(coord: Record<string, unknown>, spacing: number): string | undefined {
  if (coord.alt === true) return undefined;
  return `${Math.floor(Number(coord.x) / spacing)}:${Math.floor(Number(coord.y) / spacing)}`;
}

export function rowInGameSyncScope(model: string, row: Record<string, unknown>, scope: GameSyncScope): boolean {
  if (actorModels.has(model)) return scope.actor !== undefined && syncScalar(row.actor) === syncScalar(scope.actor);
  const expedition = scope.expedition;
  if (!expedition || sharedModels.has(model)) return true;
  const own = (value: unknown) => expedition.owners.has(syncScalar(value));
  const entity = (value: unknown) => expedition.entities.has(syncScalar(value));
  const region = (coord: Record<string, unknown>) => {
    const key = gameSyncRegion(coord, expedition.spacing);
    return key !== undefined && expedition.regions.has(key);
  };
  switch (model) {
    case "AddressName":
      return own(row.address);
    case "RealmTraits":
      return expedition.realmTraits.has(syncScalar(row.realm_id));
    case "EntryEntitlement":
    case "PlayerEntry":
    case "VillagePass":
    case "Liquidity":
    case "StoryEvent":
      return own(row.owner);
    case "Guild":
      return own(row.guild_id);
    case "GuildMember":
      return own(row.actor);
    case "GuildWhitelist":
    case "ChestPity":
    case "BitcoinContribution":
    case "PlayerFaithPoints":
    case "PointsAwarded":
      return own(row.player);
    case "ChestTokens":
    case "ChestReward":
      return own(row.player) && Number(row.epoch) === expedition.epoch;
    case "PlayerPoints":
      return own(row.address);
    case "TileOpt":
      return region({ alt: row.alt, x: row.col, y: row.row });
    case "Building":
      return expedition.realms.has(syncScalar(row.outer_entity_id));
    case "ExplorerTroops":
      return entity(row.explorer_id);
    case "Guard":
    case "FaithfulStructure":
      return entity(row.structure_id);
    case "BitcoinClaim":
      return entity(row.mine_id);
    case "TradeOrder":
      return entity(row.maker_id) || entity(row.taker_id);
    case "BattleEvent":
      return entity(row.attacker_id) || entity(row.defender_id);
    case "RaidEvent":
      return own(row.player) || own(row.target_owner);
    case "WonderFaith":
      return own(row.last_recorded_owner);
    case "ProductionReceiver":
      return expedition.realms.has(syncScalar(row.home));
    case "ResourceProduction":
      return entity(row.entity_id) || expedition.productionSources.has(syncScalar(row.entity_id));
    case "Structure":
    case "BankName":
    case "VillageRaid":
    case "BitcoinMine":
    case "ResourceBalance":
    case "ProductionBonus":
    case "ResourceWeight":
    case "ResourceArrival":
    case "StructureBuildings":
    case "Hyperstructure":
    case "HyperstructureProgress":
    case "HyperstructureShares":
    case "EntityName":
      return entity(row.entity_id);
    default:
      throw new Error(`No subscription scope for ${model}`);
  }
}
