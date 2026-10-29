import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import { BuildingType, getProducedResource, StructureType, type StructureNamingMode } from "@bibliothecadao/types";
import { frontierBeast, isGuardedSite, nativeGameModeOf, readFrontierBeast } from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { NativeRows, NativeStoryVariant } from "../../../../../contracts/l3/world-native/schema/client.gen";
import { iconDefinition, type IconMeaning, resourceMeaning } from "./icon-meaning";

/** Every story the game can emit (the schema's story variants, a fight and a raid), by the act it tells. */
const storyMeanings = {
  BattleEvent: "attack",
  RaidEvent: "raid",
  FaithPointsClaimedStory: "shrine",
  FaithPledged: "shrine",
  FaithRemoved: "shrine",
  StructureLevelUpStory: "upgrade",
  RealmCreatedStory: "realm",
  StructureCapturedStory: "flag",
  GuardAddStory: "defend",
  GuardDeleteStory: "defend",
  ResourceBurnStory: "flame",
  ResourceTransferStory: "transfer",
  ResourceReceiveArrivalStory: "transfer",
  ProductionStory: "produce",
  BuildingPlacementStory: "build",
  BuildingPaymentStory: "build",
  BitcoinAwardStory: "bitcoin-mine",
  TradeCreated: "trade",
  TradeAccepted: "trade",
  TradeCancelled: "trade",
  BankSwap: "swap",
  BankLiquidity: "bank",
  HyperstructurePoints: "hyperstructure",
  RelicChestOpened: "relics",
  RelicCrafted: "relics",
  RelicActivated: "relics",
  ExplorationReward: "explore",
  SpireDiscovered: "spire",
  SitePayout: "flag",
  RewardChestOpened: "reward-chest",
  SeasonEnded: "victory",
  BlitzFinalized: "victory",
  ExplorerCreateStory: "deploy",
  ExplorerAddStory: "deploy",
  ExplorerDeleteStory: "military",
  TroopsTransferred: "military",
  LordsWithdrawn: "lords",
  TierBought: "research",
  SkillPointSpent: "research",
  SiteUsed: "claim",
} satisfies Record<NativeStoryVariant | "BattleEvent" | "RaidEvent" | "TierBought", IconMeaning>;

/** A story's painting, by its kind: the one table every Feed, Events and Log row reads. */
export function storyMeaning(story: string): IconMeaning {
  if (!Object.hasOwn(storyMeanings, story)) throw new Error(`Unknown story icon: ${story}`);
  return storyMeanings[story as keyof typeof storyMeanings];
}

const structureMeanings = {
  [StructureType.Realm]: "realm",
  [StructureType.Village]: "village",
  [StructureType.Camp]: "camp",
  [StructureType.Mine]: "mine",
  [StructureType.Hyperstructure]: "hyperstructure",
  [StructureType.Bank]: "bank",
  [StructureType.BitcoinMine]: "bitcoin-mine",
  [StructureType.Rift]: "rift",
  [StructureType.Ruin]: "ruin",
  [StructureType.Beasts]: "beasts",
} satisfies Record<StructureType, IconMeaning>;
export function structureMeaning(
  category: StructureType,
  mode?: StructureNamingMode,
  guard?: FrontierSpecies,
): IconMeaning {
  if (mode === "frontier") {
    if (guard) return beastMeaning(guard);
    // A ruin keeps its landmark; every other guarded site is drawn as its guard.
    if (isGuardedSite(category) && category !== StructureType.Ruin)
      return beastMeaning(frontierBeast(0, category, "lowly").beast);
  }
  return structureMeanings[category];
}

/** An encounter's initial guard identifies its painting, even after casualties; other modes retain the site's kind. */
export function readStructureMeaning(
  store: Pick<NativeFactStore, "get" | "require">,
  structure: NativeRows["Structure"],
): IconMeaning {
  const category = structure.base.category;
  if (!isGuardedSite(category)) return structureMeaning(category);
  const mode = nativeGameModeOf(store.require("GameRegistry", { game_id: structure.game_id }).preset_id);
  const guard =
    mode === "frontier"
      ? readFrontierBeast(store, structure.game_id, safeInteger(structure.entity_id))?.beast
      : undefined;
  return structureMeaning(category, mode, guard);
}

export function mineMeaning(kind: number): IconMeaning {
  if (kind === 1) return "rift";
  if (kind === 2) return "mine";
  throw new Error(`Unknown mine icon: ${kind}`);
}
export function realmMeaning(level: number) {
  const meaning = (["realm-0", "realm-1", "realm-2", "realm-3"] as const)[level];
  if (!meaning) throw new Error(`Unknown realm level: ${level}`);
  return meaning;
}

export function realmMarkerMeaning(level: number) {
  return `map-${realmMeaning(level)}` as const;
}

/** The buildings painted as themselves, named as buildings in every game; the rest wear what they make. */
const BUILDING_PAINTINGS: Partial<Record<BuildingType, IconMeaning>> = {
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceLabor]: "workshop",
  [BuildingType.WorkersHut]: "workers-hut",
  [BuildingType.Storehouse]: "storehouse",
  [BuildingType.WarHall]: "war-hall",
  [BuildingType.SupplyYard]: "supply-yard",
  [BuildingType.ScoutsLodge]: "scout-lodge",
  [BuildingType.Hearth]: "hearth",
};
/** Frontier names its troop building Barracks (buildingName), and paints it so; elsewhere it is "Knight T1". */
const FRONTIER_BUILDING_PAINTINGS: Partial<Record<BuildingType, IconMeaning>> = {
  [BuildingType.ResourceKnightT1]: "barracks",
};

/**
 * A building's painting, the one way every card, menu and list draws it: its own where it has one, else what it makes
 * (a Market its donkey, a Knight T2 building its troops). A building with neither is loud.
 */
export function buildingMeaning(building: BuildingType, frontier = false): IconMeaning {
  const own = (frontier ? FRONTIER_BUILDING_PAINTINGS[building] : undefined) ?? BUILDING_PAINTINGS[building];
  if (own) return own;
  const made = getProducedResource(building);
  if (made === undefined) throw new Error(`Building ${building} has no painting`);
  return resourceMeaning(made);
}

/** Species identity selects the painting, independent of combat tier and remaining strength. */
export function beastMeaning(species: FrontierSpecies): IconMeaning {
  return `beast-${species}`;
}

export function troopMeaning(troops: { category: string; tier: string }): IconMeaning {
  const name = `${troops.category.toLowerCase()}-${troops.tier.toLowerCase()}` as IconMeaning;
  if (!/^(knight|crossbowman|paladin)-t[123]$/.test(name)) throw new Error(`Unknown troop icon: ${name}`);
  iconDefinition(name);
  return name;
}

/** Reward rank bands use the approved sealed/opened chest family, never the world's crate. */
export function rewardChestMeaning(band?: number, opened = false): IconMeaning {
  if (band === undefined) return "reward-chest";
  if (!Number.isInteger(band) || band < 0 || band > 4) throw new Error(`Unknown reward chest band: ${band}`);
  return `reward-chest-${band}${opened ? "-opened" : ""}` as IconMeaning;
}
