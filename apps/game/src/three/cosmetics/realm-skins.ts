import {
  DRAWN_REALM_SKINS,
  holdsRealmSkin,
  isDrawnRealmSkin,
  REALM_SKIN_FAMILIES,
  wornRealmSkinFamily,
} from "@bibliothecadao/eternum";
import { type AspectId, aspectName, aspects, RealmLevels } from "@bibliothecadao/types";
import paintings from "@/ui/design-system/home-icons.json";
import { homeIcon } from "@/ui/design-system/home-icons";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";

export type RealmSkinFamily = keyof typeof COSMETICS_WORDS.families;

const NO_PAINTING_YET = "no painting yet";

export interface RealmSkin {
  readonly id: string;
  readonly family: RealmSkinFamily;
  readonly name: string;
  readonly aspect?: AspectId;
  readonly paintings: keyof typeof paintings | typeof NO_PAINTING_YET;
}

export interface RealmSkinFacts {
  readonly sealHeld: boolean;
  readonly aspect: AspectId | null;
  readonly hasWonder: boolean;
  readonly equipped: number;
}

export const REALM_SKIN_CODES = {
  wonder: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN,
  "season-1": REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN,
  devcon: null,
  base: REALM_SKIN_FAMILIES.BASE_REALM_SKIN,
} as const satisfies Record<RealmSkinFamily, number | null>;

export type RealmSkinStanding = keyof typeof COSMETICS_WORDS.standing;

export const REALM_RANKS = Object.values(RealmLevels).filter((rank): rank is RealmLevels => typeof rank === "number");

const slugOf = (aspect: AspectId) => aspectName(aspect).toLowerCase();

export const BASE_REALM_SKIN: RealmSkin = {
  id: "base",
  family: "base",
  name: COSMETICS_WORDS.courtyardKeep,
  paintings: "realm",
};

const UNALIGNED_WONDER: RealmSkin = {
  id: "wonder",
  family: "wonder",
  name: COSMETICS_WORDS.families.wonder,
  paintings: "wonder",
};

export const REALM_SKINS: readonly RealmSkin[] = [
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `wonder-${slugOf(id)}`,
      family: "wonder",
      name: aspectName(id),
      aspect: id,
      paintings: "wonder",
    }),
  ),
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `season-1-${slugOf(id)}`,
      family: "season-1",
      name: aspectName(id),
      aspect: id,
      paintings: NO_PAINTING_YET,
    }),
  ),
  {
    id: "devcon",
    family: "devcon",
    name: COSMETICS_WORDS.devcon,
    paintings: "devcon",
  },
  {
    id: "devcon-golden",
    family: "devcon",
    name: COSMETICS_WORDS.goldenDevcon,
    paintings: "devcon-golden",
  },
  BASE_REALM_SKIN,
];

export const realmSkinWearableOnRealm = (skin: RealmSkin, facts: RealmSkinFacts): boolean =>
  skin.aspect === undefined || skin.aspect === facts.aspect;

export const realmSkinStanding = (skin: RealmSkin, facts: RealmSkinFacts): RealmSkinStanding => {
  const code = REALM_SKIN_CODES[skin.family];
  if (code === null) return "event";
  if (skin.family === "season-1") {
    return holdsRealmSkin({ ...facts, aspect: skin.aspect ?? facts.aspect }, code) ? "owned" : "pass";
  }
  if (realmSkinWearableOnRealm(skin, facts) && holdsRealmSkin(facts, code)) return "owned";
  return skin.family === "wonder" ? "wonder" : "pass";
};

const familyOfCode = (code: number): RealmSkinFamily =>
  REALM_SKINS.find((skin) => REALM_SKIN_CODES[skin.family] === code)?.family ?? BASE_REALM_SKIN.family;

export const REALM_SKIN_DEFAULT_ORDER: readonly RealmSkinFamily[] = DRAWN_REALM_SKINS.map(familyOfCode);

export const realmSkinIsDrawn = (skin: RealmSkin): boolean => {
  const code = REALM_SKIN_CODES[skin.family];
  return code !== null && isDrawnRealmSkin(code);
};

export const realmSkinsFor = (facts: RealmSkinFacts): readonly RealmSkin[] =>
  facts.hasWonder && facts.aspect === null ? [UNALIGNED_WONDER, ...REALM_SKINS] : REALM_SKINS;

export const wornRealmSkin = (facts: RealmSkinFacts): RealmSkin => {
  const family = familyOfCode(wornRealmSkinFamily(facts, facts.equipped));
  return (
    realmSkinsFor(facts).find((skin) => skin.family === family && realmSkinWearableOnRealm(skin, facts)) ??
    BASE_REALM_SKIN
  );
};

export const wearsDefaultSkin = (facts: RealmSkinFacts): boolean =>
  wornRealmSkinFamily(facts, facts.equipped) === wornRealmSkinFamily(facts, REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN);

export const realmSkinIcon = (skin: RealmSkin, level: RealmLevels): IconMeaning | undefined =>
  skin.paintings === NO_PAINTING_YET ? undefined : homeIcon(skin.paintings, level);
