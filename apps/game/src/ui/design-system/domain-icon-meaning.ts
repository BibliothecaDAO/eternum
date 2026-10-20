import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import { StructureType } from "@bibliothecadao/types";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
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
export function structureMeaning(category: StructureType): IconMeaning {
  return structureMeanings[category];
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
