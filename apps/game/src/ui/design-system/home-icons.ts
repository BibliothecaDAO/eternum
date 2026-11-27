import { REALM_SKIN_FAMILIES, realmWornSkinFamily, wornRealmSkinFamily } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, orderAspect, type AspectId, type RealmLevels } from "@bibliothecadao/types";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
import paintings from "./home-icons.json";
import { REALM } from "./kit/words";

export type HomeKind = "realm" | "wonder";
export type HomePaintingKind = keyof typeof paintings;

/** Every home kind has a distinct painting at every age; board captures read the same catalog. */
const icons = paintings satisfies Record<HomeKind, Record<RealmLevels, string>>;
export const HOME_KINDS = {
  realm: { label: REALM },
  wonder: { label: "Wonder" },
} satisfies Record<HomeKind, { label: string }>;

export const homeKind = (hasWonder = false): HomeKind => (hasWonder ? "wonder" : "realm");

export function seasonOnePainting(aspect: AspectId): HomePaintingKind {
  const key = `season-1-${aspectName(aspect).toLowerCase()}`;
  if (!Object.hasOwn(paintings, key)) throw new Error(`Unknown Season 1 painting for aspect: ${aspect}`);
  return key as HomePaintingKind;
}

export const realmPaintingKind = (family: number, aspect: AspectId | null): HomePaintingKind => {
  if (family === REALM_SKIN_FAMILIES.WONDER_REALM_SKIN) return "wonder";
  if (family === REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN && aspect !== null) return seasonOnePainting(aspect);
  return "realm";
};

export const realmSkinPainting = (
  store: Pick<NativeFactStore, "get">,
  structure: Pick<NativeRows["Structure"], "game_id" | "entity_id" | "owner"> & {
    readonly metadata: Pick<NativeRows["Structure"]["metadata"], "has_wonder" | "order">;
  },
): HomePaintingKind => {
  const aspect = structure.metadata.order ? (orderAspect(structure.metadata.order) ?? null) : null;
  return realmPaintingKind(realmWornSkinFamily(store, structure, aspect), aspect);
};

export const entryRealmPainting = (entry: {
  readonly order: number;
  readonly has_wonder?: boolean;
  readonly ancient_seal?: boolean;
  readonly realm_skin?: number;
}): { readonly hasWonder: boolean; readonly painting: HomePaintingKind } => {
  const aspect = entry.order ? (orderAspect(entry.order) ?? null) : null;
  const family = wornRealmSkinFamily(
    { hasWonder: entry.has_wonder === true, sealHeld: entry.ancient_seal === true, aspect },
    entry.realm_skin ?? REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN,
  );
  return {
    hasWonder: family === REALM_SKIN_FAMILIES.WONDER_REALM_SKIN,
    painting: realmPaintingKind(family, aspect),
  };
};

export function homeIcon(kind: HomePaintingKind, level: number): IconMeaning {
  const levels: Readonly<Record<number, string>> = icons[kind];
  const icon = levels[level];
  if (!Number.isInteger(level) || !icon) throw new Error(`Unknown realm level: ${level}`);
  const meaning = icon as IconMeaning;
  iconDefinition(meaning);
  return meaning;
}
