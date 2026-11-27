import {
  realmAspect,
  realmOrderAspect,
  REALM_SKIN_FAMILIES,
  realmWornSkinFamily,
  wornRealmSkinFamily,
} from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeRows } from "@bibliothecadao/eternum/game-client";
import { aspectName, type AspectId, type RealmLevels } from "@bibliothecadao/types";
import { iconDefinition, type IconMeaning } from "./icon-meaning";
import paintings from "./home-icons.json";
import { COSMETICS_WORDS, REALM } from "./kit/words";

export type HomePaintingKind = keyof typeof paintings;

const ASPECT_WONDER_PAINTINGS = {
  1: "wonder-prowess",
  2: "wonder-luminary",
  3: "wonder-havoc",
  4: "wonder-insight",
} as const satisfies Record<AspectId, HomePaintingKind>;

const ASPECT_SEASON_ONE_PAINTINGS = {
  1: "season-1-prowess",
  2: "season-1-luminary",
  3: "season-1-havoc",
  4: "season-1-insight",
} as const satisfies Record<AspectId, HomePaintingKind>;

type WonderHomeKind = (typeof ASPECT_WONDER_PAINTINGS)[AspectId];
export type HomeKind = "realm" | WonderHomeKind;

const icons = paintings satisfies Record<HomeKind, Record<RealmLevels, string>>;
export const HOME_KINDS = {
  realm: { label: REALM },
  "wonder-prowess": { label: `${COSMETICS_WORDS.families.wonder} · ${aspectName(1)}` },
  "wonder-luminary": { label: `${COSMETICS_WORDS.families.wonder} · ${aspectName(2)}` },
  "wonder-havoc": { label: `${COSMETICS_WORDS.families.wonder} · ${aspectName(3)}` },
  "wonder-insight": { label: `${COSMETICS_WORDS.families.wonder} · ${aspectName(4)}` },
} satisfies Record<HomeKind, { label: string }>;

const WONDER_PAINTING_SET = new Set<HomePaintingKind>(Object.values(ASPECT_WONDER_PAINTINGS));

export function wonderPainting(aspect: AspectId): WonderHomeKind {
  return ASPECT_WONDER_PAINTINGS[aspect];
}

export function seasonOnePainting(aspect: AspectId): HomePaintingKind {
  return ASPECT_SEASON_ONE_PAINTINGS[aspect];
}

export function isWonderPainting(painting: HomePaintingKind | undefined): painting is WonderHomeKind {
  return painting !== undefined && WONDER_PAINTING_SET.has(painting);
}

export const homeKind = (hasWonder = false, aspect: AspectId | null = null): HomeKind =>
  hasWonder && aspect !== null ? wonderPainting(aspect) : "realm";

export const realmPaintingKind = (family: number, aspect: AspectId | null): HomePaintingKind => {
  if (family === REALM_SKIN_FAMILIES.WONDER_REALM_SKIN && aspect !== null) return wonderPainting(aspect);
  if (family === REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN && aspect !== null) return seasonOnePainting(aspect);
  return "realm";
};

export const realmSkinPainting = (
  store: Pick<NativeFactStore, "get">,
  structure: Pick<NativeRows["Structure"], "game_id" | "entity_id" | "owner"> & {
    readonly metadata: Pick<NativeRows["Structure"]["metadata"], "has_wonder" | "order">;
  },
): HomePaintingKind => {
  const aspect = realmAspect(store, structure);
  return realmPaintingKind(realmWornSkinFamily(store, structure, aspect), aspect);
};

export const entryRealmPainting = (entry: {
  readonly order: number;
  readonly has_wonder?: boolean;
  readonly ancient_seal?: boolean;
  readonly realm_skin?: number;
}): { readonly hasWonder: boolean; readonly painting: HomePaintingKind } => {
  const aspect = realmOrderAspect(entry.order);
  const family = wornRealmSkinFamily(
    { hasWonder: entry.has_wonder === true, sealHeld: entry.ancient_seal === true, aspect },
    entry.realm_skin ?? REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN,
  );
  const painting = realmPaintingKind(family, aspect);
  return {
    hasWonder: isWonderPainting(painting),
    painting,
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
