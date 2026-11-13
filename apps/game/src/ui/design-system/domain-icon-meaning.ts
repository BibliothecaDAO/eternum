import { homeIcon, homeKind } from "./home-icons";
import { readRealmSkin, type RealmSkin } from "@/three/structures/realm-skins";
import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import {
  baneQuests,
  BuildingType,
  dailyQuests,
  getProducedResource,
  StructureType,
  type StructureNamingMode,
  worldBanes,
} from "@bibliothecadao/types";
import {
  frontierBeast,
  isGuardedSite,
  nativeGameModeOf,
  readFrontierBeast,
  type TriumphStage,
} from "@bibliothecadao/eternum";
import { safeInteger, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import {
  nativeBaneConstants as bane,
  nativeQuestConstants as quest,
  nativeRuleConstants as rule,
  type NativeRows,
  type NativeStoryVariant,
} from "../../../../../contracts/l3/world-native/schema/client.gen";
import { iconDefinition, type IconMeaning, resourceMeaning } from "./icon-meaning";

/** Every story the game can emit (the schema's story variants and a fight), by the act it tells. */
const storyMeanings = {
  BattleEvent: "attack",
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
} satisfies Record<NativeStoryVariant | "BattleEvent" | "TierBought", IconMeaning>;

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
  if (category === StructureType.Realm)
    return realmMeaning(structure.base.level, readRealmSkin(store, structure), structure.metadata.has_wonder);
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
export function realmMeaning(level: number, skin?: RealmSkin, hasWonder = false): IconMeaning {
  return homeIcon(homeKind(skin, hasWonder), level);
}

export function realmMarkerMeaning(level: number, skin?: RealmSkin, hasWonder = false): IconMeaning {
  if (skin || hasWonder) return realmMeaning(level, skin, hasWonder);
  return `map-${realmMeaning(level)}` as IconMeaning;
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

/** A quest's id, as the quest catalog numbers it: a daily quest, or a bane quest that replaces it. */
export type QuestId = (typeof dailyQuests)[number]["id"] | (typeof baneQuests)[number]["id"];

/** Each quest by what it asks: the beast it hunts, the site it finds, the act it counts, the fight a bane calls for. */
const questMeanings = {
  [quest.HUNT]: "beast-cyclops",
  [quest.CAMPS]: "beast-troll",
  [quest.RIFTS]: "beast-dark-fey",
  [quest.RELICS]: "ruin",
  [quest.VETERANS]: "upgrade",
  [quest.FINDS]: "explore",
  [quest.REVEALS]: "map",
  [quest.STAND]: "defend",
  [quest.LIGHTS]: "sun",
  [quest.CULL]: "skull",
} satisfies Record<QuestId, IconMeaning>;
export const questMeaning = (quest: QuestId): IconMeaning => questMeanings[quest];

/** Each bane's painting: Blood Moon the moon, Mist Tide the waves, Ash Fall the flame; a rival's the hyperstructure. */
export const BANE_MEANING = {
  world: { [bane.BLOOD_MOON]: "moon", [bane.MIST_TIDE]: "waves", [bane.ASH_FALL]: "flame" },
  team: "hyperstructure",
} as const satisfies { world: Record<(typeof worldBanes)[number]["id"], IconMeaning>; team: IconMeaning };

/** Glory, the race's one score a member reads (Season 1): the score's painting. */
export const GLORY_MEANING: IconMeaning = "victory";

/** Each Triumph's painting: the reveal, the stamina bolt, the moon over the beasts, the chest a site pays. */
const triumphMeanings = {
  [rule.CLEAR_MIST_STAGE]: "eye",
  [rule.SECOND_WIND_STAGE]: "stamina",
  [rule.PALE_MOON_STAGE]: "moon",
  [rule.SPOILS_STAGE]: "chest",
} satisfies Record<TriumphStage, IconMeaning>;
export const triumphMeaning = (stage: TriumphStage): IconMeaning => triumphMeanings[stage];
