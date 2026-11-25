import { type AspectId, aspectName, aspects, RealmLevels } from "@bibliothecadao/types";
import paintings from "@/ui/design-system/home-icons.json";
import { homeIcon } from "@/ui/design-system/home-icons";
import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { COSMETICS_WORDS } from "@/ui/design-system/kit/words";

export type RealmSkinFamily = keyof typeof COSMETICS_WORDS.families;

export const NO_MODEL_YET = "no model yet";
const NO_PAINTING_YET = "no painting yet";

type Ranked<T> = Readonly<Record<RealmLevels, T>>;

export interface RealmSkin {
  readonly id: string;
  readonly family: RealmSkinFamily;
  readonly name: string;
  readonly aspect?: AspectId;
  readonly models: Ranked<string | typeof NO_MODEL_YET>;
  readonly paintings: keyof typeof paintings | typeof NO_PAINTING_YET;
}

export interface RealmSkinFacts {
  readonly sealHeld: boolean;
  readonly aspect: AspectId | null;
  readonly wonderAspect: AspectId | null;
}

export type RealmSkinStanding = keyof typeof COSMETICS_WORDS.standing;

export const REALM_SKIN_DEFAULT_ORDER = [
  "wonder",
  "season-1",
  "devcon",
  "base",
] as const satisfies readonly RealmSkinFamily[];

export const REALM_RANKS = Object.values(RealmLevels).filter((rank): rank is RealmLevels => typeof rank === "number");

const everyRank = <T>(value: T): Ranked<T> =>
  ({
    [RealmLevels.Settlement]: value,
    [RealmLevels.City]: value,
    [RealmLevels.Kingdom]: value,
    [RealmLevels.Empire]: value,
  }) satisfies Record<RealmLevels, T>;

const slugOf = (aspect: AspectId) => aspectName(aspect).toLowerCase();

export const BASE_REALM_SKIN: RealmSkin = {
  id: "base",
  family: "base",
  name: COSMETICS_WORDS.courtyardKeep,
  models: {
    [RealmLevels.Settlement]: "settlement",
    [RealmLevels.City]: "city",
    [RealmLevels.Kingdom]: "kingdom",
    [RealmLevels.Empire]: "empire",
  } satisfies Record<RealmLevels, string>,
  paintings: "realm",
};

export const REALM_SKINS: readonly RealmSkin[] = [
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `wonder-${slugOf(id)}`,
      family: "wonder",
      name: aspectName(id),
      aspect: id,
      models: everyRank(`wonder-${slugOf(id)}`),
      paintings: "wonder",
    }),
  ),
  ...aspects.map(
    ({ id }): RealmSkin => ({
      id: `season-1-${slugOf(id)}`,
      family: "season-1",
      name: aspectName(id),
      aspect: id,
      models: everyRank(NO_MODEL_YET),
      paintings: NO_PAINTING_YET,
    }),
  ),
  {
    id: "devcon",
    family: "devcon",
    name: COSMETICS_WORDS.devcon,
    models: everyRank(NO_MODEL_YET),
    paintings: "devcon",
  },
  {
    id: "devcon-golden",
    family: "devcon",
    name: COSMETICS_WORDS.goldenDevcon,
    models: everyRank(NO_MODEL_YET),
    paintings: "devcon-golden",
  },
  BASE_REALM_SKIN,
];

export const realmSkinStanding = (skin: RealmSkin, facts: RealmSkinFacts): RealmSkinStanding => {
  switch (skin.family) {
    case "base":
      return "owned";
    case "wonder":
      return skin.aspect === facts.wonderAspect ? "owned" : "wonder";
    case "season-1":
      return facts.sealHeld && skin.aspect === facts.aspect ? "owned" : "pass";
    case "devcon":
      return "event";
  }
};

export const realmSkinIcon = (skin: RealmSkin, level: RealmLevels): IconMeaning | undefined =>
  skin.paintings === NO_PAINTING_YET ? undefined : homeIcon(skin.paintings, level);
