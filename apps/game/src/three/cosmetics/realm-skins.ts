import {
  DRAWN_REALM_SKINS,
  holdsRealmSkin,
  REALM_SKIN_FAMILIES,
  wornRealmSkinFamily,
  type DrawnRealmSkin,
} from "@bibliothecadao/eternum";
import { type AspectId, aspectName, aspects, RealmLevels } from "@bibliothecadao/types";
import { homeIcon, seasonOnePainting, wonderPainting, type HomePaintingKind } from "@/ui/design-system/home-icons";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";

export type RealmSkinFamily = keyof typeof COSMETICS_WORDS.families;

export interface RealmSkin {
  readonly id: string;
  readonly family: RealmSkinFamily;
  readonly code: DrawnRealmSkin;
  readonly name: string;
  readonly aspect?: AspectId;
  readonly paintings: HomePaintingKind;
}

export interface RealmSkinFacts {
  readonly sealHeld: boolean;
  readonly aspect: AspectId | null;
  readonly hasWonder: boolean;
  readonly equipped: number;
  readonly devconHeld?: boolean;
  readonly goldenDevconHeld?: boolean;
  readonly devUnlocked?: boolean;
}

export type RealmSkinStanding = keyof typeof COSMETICS_WORDS.standing;

export const REALM_RANKS = Object.values(RealmLevels).filter((rank): rank is RealmLevels => typeof rank === "number");

const slugOf = (aspect: AspectId) => aspectName(aspect).toLowerCase();

export const BASE_REALM_SKIN: RealmSkin = {
  id: "base",
  family: "base",
  code: REALM_SKIN_FAMILIES.BASE_REALM_SKIN,
  name: COSMETICS_WORDS.courtyardKeep,
  paintings: "realm",
};

export const REALM_SKINS: readonly RealmSkin[] = [
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `wonder-${slugOf(id)}`,
      family: "wonder",
      code: REALM_SKIN_FAMILIES.WONDER_REALM_SKIN,
      name: aspectName(id),
      aspect: id,
      paintings: wonderPainting(id),
    }),
  ),
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `season-1-${slugOf(id)}`,
      family: "season-1",
      code: REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN,
      name: aspectName(id),
      aspect: id,
      paintings: seasonOnePainting(id),
    }),
  ),
  {
    id: "devcon",
    family: "devcon",
    code: REALM_SKIN_FAMILIES.DEVCON_REALM_SKIN,
    name: COSMETICS_WORDS.devcon,
    paintings: "devcon",
  },
  {
    id: "devcon-golden",
    family: "devcon",
    code: REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN,
    name: COSMETICS_WORDS.goldenDevcon,
    paintings: "devcon-golden",
  },
  BASE_REALM_SKIN,
];

export const realmSkinWearableOnRealm = (skin: RealmSkin, facts: RealmSkinFacts): boolean =>
  skin.aspect === undefined || skin.aspect === facts.aspect;

export const realmSkinStanding = (skin: RealmSkin, facts: RealmSkinFacts): RealmSkinStanding => {
  if (skin.family === "season-1") {
    return holdsRealmSkin({ ...facts, aspect: skin.aspect ?? facts.aspect }, skin.code) ? "owned" : "pass";
  }
  if (skin.family === "devcon") {
    return holdsRealmSkin(facts, skin.code) ? "owned" : "event";
  }
  if (realmSkinWearableOnRealm(skin, facts) && holdsRealmSkin(facts, skin.code)) return "owned";
  return skin.family === "wonder" ? "wonder" : "pass";
};

const REALM_SKIN_ORDER_LABELS = {
  [REALM_SKIN_FAMILIES.WONDER_REALM_SKIN]: COSMETICS_WORDS.families.wonder,
  [REALM_SKIN_FAMILIES.SEASON_ONE_REALM_SKIN]: COSMETICS_WORDS.families["season-1"],
  [REALM_SKIN_FAMILIES.GOLDEN_DEVCON_REALM_SKIN]: COSMETICS_WORDS.goldenDevcon,
  [REALM_SKIN_FAMILIES.DEVCON_REALM_SKIN]: COSMETICS_WORDS.devcon,
  [REALM_SKIN_FAMILIES.BASE_REALM_SKIN]: COSMETICS_WORDS.families.base,
} as const satisfies Record<DrawnRealmSkin, string>;

export const REALM_SKIN_DEFAULT_ORDER: readonly string[] = DRAWN_REALM_SKINS.map(
  (code) => REALM_SKIN_ORDER_LABELS[code],
);

export const wornRealmSkin = (facts: RealmSkinFacts): RealmSkin => {
  const code = wornRealmSkinFamily(facts, facts.equipped);
  return REALM_SKINS.find((skin) => skin.code === code && realmSkinWearableOnRealm(skin, facts)) ?? BASE_REALM_SKIN;
};

export const wearsDefaultSkin = (facts: RealmSkinFacts): boolean =>
  wornRealmSkin(facts).id === wornRealmSkin({ ...facts, equipped: REALM_SKIN_FAMILIES.DEFAULT_REALM_SKIN }).id;

export const realmSkinIcon = (skin: RealmSkin, level: RealmLevels): IconMeaning => homeIcon(skin.paintings, level);
