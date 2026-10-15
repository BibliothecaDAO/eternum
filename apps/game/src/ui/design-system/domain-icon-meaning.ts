import { BuildingType, ResourceMiningTypes, StructureType } from "@bibliothecadao/types";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
const buildingMeanings = {
  [BuildingType.ResourceLabor]: "realm",
  [BuildingType.ResourceAncientFragment]: "mine",
  [BuildingType.ResourceStone]: "mine",
  [BuildingType.ResourceCoal]: "mine",
  [BuildingType.ResourceWood]: "lumber-mill",
  [BuildingType.ResourceCopper]: "forge",
  [BuildingType.ResourceIronwood]: "lumber-mill",
  [BuildingType.ResourceObsidian]: "mine",
  [BuildingType.ResourceGold]: "forge",
  [BuildingType.ResourceSilver]: "forge",
  [BuildingType.ResourceMithral]: "forge",
  [BuildingType.ResourceAlchemicalSilver]: "forge",
  [BuildingType.ResourceColdIron]: "forge",
  [BuildingType.ResourceDeepCrystal]: "mine",
  [BuildingType.ResourceRuby]: "mine",
  [BuildingType.ResourceDiamonds]: "mine",
  [BuildingType.ResourceHartwood]: "lumber-mill",
  [BuildingType.ResourceIgnium]: "forge",
  [BuildingType.ResourceTwilightQuartz]: "mine",
  [BuildingType.ResourceTrueIce]: "mine",
  [BuildingType.ResourceAdamantine]: "forge",
  [BuildingType.ResourceSapphire]: "mine",
  [BuildingType.ResourceEtherealSilica]: "mine",
  [BuildingType.ResourceDragonhide]: "dragon-tannery",
  [BuildingType.ResourceWheat]: "farm",
  [BuildingType.ResourceFish]: "fishing-village",
  [BuildingType.ResourceKnightT1]: "barracks",
  [BuildingType.ResourceKnightT2]: "barracks",
  [BuildingType.ResourceKnightT3]: "barracks",
  [BuildingType.ResourcePaladinT1]: "stable",
  [BuildingType.ResourcePaladinT2]: "stable",
  [BuildingType.ResourcePaladinT3]: "stable",
  [BuildingType.ResourceDonkey]: "supply-yard",
  [BuildingType.ResourceCrossbowmanT1]: "archery",
  [BuildingType.ResourceCrossbowmanT2]: "archery",
  [BuildingType.ResourceCrossbowmanT3]: "archery",
  [BuildingType.WorkersHut]: "workers-hut",
  [BuildingType.Storehouse]: "storehouse",
  [BuildingType.ResourceResearch]: "research-lab",
  [BuildingType.WarHall]: "war-hall",
  [BuildingType.SupplyYard]: "supply-yard",
  [BuildingType.ScoutsLodge]: "scout-lodge",
  [BuildingType.Hearth]: "hearth",
  [ResourceMiningTypes.Forge]: "forge",
  [ResourceMiningTypes.Mine]: "mine",
  [ResourceMiningTypes.LumberMill]: "lumber-mill",
  [ResourceMiningTypes.Dragonhide]: "dragon-tannery",
} satisfies Record<number | ResourceMiningTypes, IconMeaning>;
export function buildingMeaning(building: number | ResourceMiningTypes): IconMeaning {
  const meaning = buildingMeanings[building as keyof typeof buildingMeanings];
  if (!meaning) throw new Error(`Unknown building icon: ${building}`);
  return meaning;
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
  [StructureType.Stragglers]: "stragglers",
} satisfies Record<StructureType, IconMeaning>;
export function structureMeaning(category: StructureType): IconMeaning {
  return structureMeanings[category];
}

export function mineMeaning(kind: number): IconMeaning {
  if (kind === 1) return "rift";
  if (kind === 2) return "mine";
  throw new Error(`Unknown mine icon: ${kind}`);
}
export function realmMeaning(level: number): IconMeaning {
  return (["realm-0", "realm-1", "realm-2", "realm-3"] as const)[Math.min(3, Math.max(0, Math.floor(level)))];
}

export function troopMeaning(troops: { category: string; tier: string }): IconMeaning {
  const name = `${troops.category.toLowerCase()}-${troops.tier.toLowerCase()}` as IconMeaning;
  if (!/^(knight|crossbowman|paladin)-t[123]$/.test(name)) throw new Error(`Unknown troop icon: ${name}`);
  iconDefinition(name);
  return name;
}
