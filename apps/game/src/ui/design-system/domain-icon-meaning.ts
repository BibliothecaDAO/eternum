import { homeIcon, homeKind, realmSkinPainting, type HomePaintingKind } from "./home-icons";
import {
  aspectName,
  BuildingType,
  deepSites,
  getProducedResource,
  StructureType,
  type AspectId,
  type StructureNamingMode,
} from "@bibliothecadao/types";
import {
  frontierBeast,
  isGuardedSite,
  nativeGameModeOfFamily,
  readFrontierBeast,
  type ArchivedStoryVariant,
  type FrontierSpecies,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  nativeFactModels,
  type NativeRows,
  type NativeStoryVariant,
} from "../../../../../contracts/l3/world-native/schema/client.gen";
import { iconDefinition, resourceMeaning, type IconMeaning } from "./icon-meaning";

const archivedStoryMeanings = {
  FaithPointsClaimedStory: "shrine",
  FaithPledged: "shrine",
  FaithRemoved: "shrine",
  TradeCreated: "trade",
  TradeAccepted: "trade",
  TradeCancelled: "trade",
  BankSwap: "swap",
  BankLiquidity: "bank",
  TierBought: "research",
  SkillPointSpent: "research",
} satisfies Record<ArchivedStoryVariant, IconMeaning>;

/** Every story the game can emit (the schema's story variants, a fight and a raid), by the act it tells. */
const storyMeanings = {
  ...archivedStoryMeanings,
  BattleEvent: "attack",
  RaidEvent: "raid",
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
  ExplorationReward: "explore",
  SpireDiscovered: "spire",
  SitePayout: "flag",
  BlitzFinalized: "victory",
  ExplorerCreateStory: "deploy",
  ExplorerAddStory: "deploy",
  ExplorerDeleteStory: "military",
  TroopsTransferred: "military",
  LordsWithdrawn: "lords",
  SiteUsed: "claim",
} satisfies Record<NativeStoryVariant | "BattleEvent" | "RaidEvent" | keyof typeof archivedStoryMeanings, IconMeaning>;

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
  [StructureType.Rift]: "rift",
  [StructureType.Ruin]: "ruin",
  [StructureType.Beasts]: "beasts",
  [StructureType.DeepSite]: "deep-crystal",
} satisfies Record<StructureType, IconMeaning>;
export const DEEP_SITE_MEANINGS = {
  foundation: "hyperstructure",
  core: "essence",
  mine: "pickaxe",
  altar: "flame",
} as const satisfies Record<(typeof deepSites)[number]["key"], IconMeaning>;

export function deepSiteMeaning(kind: number): IconMeaning {
  const site = deepSites.find(({ id }) => id === kind);
  if (!site) throw new Error(`Unknown Deep site kind ${kind}`);
  return DEEP_SITE_MEANINGS[site.key];
}

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
  if (category === StructureType.Realm) return homeIcon(realmSkinPainting(store, structure), structure.base.level);
  if (category === StructureType.DeepSite)
    return deepSiteMeaning(
      store.require("DeepSite", { game_id: structure.game_id, entity_id: structure.entity_id }).kind,
    );
  if (!isGuardedSite(category)) return structureMeaning(category);
  const mode = nativeGameModeOfFamily(store.require("GameRegistry", { game_id: structure.game_id }).family);
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
export function realmMeaning(
  level: number,
  hasWonder = false,
  painting?: HomePaintingKind,
  aspect: AspectId | null = null,
): IconMeaning {
  return homeIcon(painting ?? homeKind(hasWonder, aspect), level);
}

export function realmMarkerMeaning(
  level: number,
  hasWonder = false,
  painting?: HomePaintingKind,
  aspect: AspectId | null = null,
): IconMeaning {
  const kind = painting ?? homeKind(hasWonder, aspect);
  if (kind !== "realm") return homeIcon(kind, level);
  return `map-${realmMeaning(level)}` as IconMeaning;
}

const BUILDING_PAINTINGS: Partial<Record<BuildingType, IconMeaning>> = {
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceLabor]: "workshop",
  [BuildingType.WorkersHut]: "workers-hut",
  [BuildingType.Storehouse]: "storehouse",
  [BuildingType.RationsDepot]: "rations",
  [BuildingType.SupplyYard]: "supply-yard",
  [BuildingType.ScoutsLodge]: "scout-lodge",
  [BuildingType.ConscriptionCamp]: "camp",
};

const FRONTIER_BUILDING_PAINTINGS: Partial<Record<BuildingType, IconMeaning>> = {
  [BuildingType.ResourceKnightT1]: "barracks",
  [BuildingType.ResourceCrossbowmanT1]: "war-hall",
};

export function buildingMeaning(building: BuildingType, frontier = false): IconMeaning {
  const own = (frontier ? FRONTIER_BUILDING_PAINTINGS[building] : undefined) ?? BUILDING_PAINTINGS[building];
  if (own) return own;
  const made = getProducedResource(building);
  if (made === undefined) throw new Error(`Building ${building} has no painting`);
  return resourceMeaning(made);
}

export type RelicKind = NativeRows["ArmyRelicEffect"]["kind"];

export const RELIC_KINDS = nativeFactModels.ArmyRelicEffect.fields.kind.enum as readonly RelicKind[];

const RELIC_MEANINGS = {
  Blade: "damage-relic-2",
  Ward: "damage-reduction-relic-2",
  Plunder: "exploration-reward-relic-2",
  StaminaRegen: "stamina-relic-2",
} satisfies Record<RelicKind, IconMeaning>;

export function relicMeaning(kind: RelicKind): IconMeaning {
  return RELIC_MEANINGS[kind];
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

export function aspectCardUrl(aspect: AspectId): string {
  return `/images/aspects/${aspectName(aspect).toLowerCase()}-card.webp`;
}
