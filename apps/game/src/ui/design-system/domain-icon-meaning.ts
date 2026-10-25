import type { FrontierSpecies } from "@/three/structures/frontier-beast";
import { StructureType, type StructureNamingMode } from "@bibliothecadao/types";
import { frontierBeast, nativeGameModeOf, readFrontierBeast } from "@bibliothecadao/eternum";
import type { NativeFactStore } from "@bibliothecadao/eternum/game-client";
import type { NativeRows } from "../../../../../contracts/l3/world-native/schema/client.gen";
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
export function structureMeaning(
  category: StructureType,
  mode?: StructureNamingMode,
  guard?: FrontierSpecies,
): IconMeaning {
  if (mode === "frontier") {
    if (guard) return beastMeaning(guard);
    if ([StructureType.Camp, StructureType.Beasts, StructureType.Rift].includes(category))
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
  if (![StructureType.Camp, StructureType.Beasts, StructureType.Rift, StructureType.Ruin].includes(category))
    return structureMeaning(category);
  const mode = nativeGameModeOf(store.require("GameRegistry", { game_id: structure.game_id }).preset_id);
  const guard =
    mode === "frontier" ? readFrontierBeast(store, structure.game_id, structure.entity_id)?.beast : undefined;
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
