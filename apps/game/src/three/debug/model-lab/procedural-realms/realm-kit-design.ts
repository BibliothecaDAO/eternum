import { foldEntityId } from "@bibliothecadao/types";

export type RealmKitLevel = 0 | 1 | 2 | 3;
export type Rgb = readonly [number, number, number];

/** One kit module drawn where another module (or itself) stands in the level's fixed design. */
export interface RealmKitPlacement {
  module: string;
  /** The module whose place in the fixed design this one takes. */
  at: string;
  heightScale: number;
  yaw: number;
}

export interface RealmKitDesign {
  placements: RealmKitPlacement[];
  stone: Rgb;
  roof: Rgb;
}

/** What a player's Realm brings: its NFT id, and how many resources the NFT lists (1 to 7). */
export interface RealmKitTraits {
  realmId: number;
  resourceCount: number;
}

/** The ring (walls, gate, banners, ground) every level keeps, so the door faces the camera in every design. */
export const REALM_KIT_RING = "ring";

const WHITE: Rgb = [1, 1, 1];
const STONE_TINTS: readonly Rgb[] = [
  WHITE,
  [1.08, 1.0, 0.88],
  [0.9, 0.96, 1.08],
  [1.12, 1.1, 1.06],
  [0.82, 0.84, 0.88],
];
const ROOF_TINTS: readonly Rgb[] = [
  WHITE,
  [1.25, 0.78, 0.66],
  [0.72, 1.08, 1.06],
  [0.78, 0.84, 1.12],
  [0.86, 1.1, 0.78],
  [1.2, 1.02, 0.66],
];

/** A synthetic or campaign home (no traits) keeps the level's fixed design: today's shipped model. */
export function resolveRealmKitDesign(level: RealmKitLevel, traits?: RealmKitTraits): RealmKitDesign {
  if (!traits) return { placements: fixedDesign(level), stone: WHITE, roof: WHITE };
  const random = seededRandom(traits.realmId, level);
  const pick = <T>(items: readonly T[]) => items[Math.floor(random() * items.length)];
  const grandeur = (traits.resourceCount - 1) / 6;
  return {
    placements: [
      { module: REALM_KIT_RING, at: REALM_KIT_RING, heightScale: 1, yaw: 0 },
      ...LEVEL_DESIGNS[level](random, grandeur, pick),
    ],
    stone: pick(STONE_TINTS),
    roof: pick(ROOF_TINTS),
  };
}

type Random = () => number;
type Pick = <T>(items: readonly T[]) => T;

/** Every level picks its modules for fixed places; heights lean taller for Realms that list more resources. */
const LEVEL_DESIGNS: Record<RealmKitLevel, (random: Random, grandeur: number, pick: Pick) => RealmKitPlacement[]> = {
  0: (random, _grandeur, pick) => {
    const rear = pick([
      ["shelter", "tent"],
      ["tent", "shelter"],
      ["tent", "tent"],
      ["cottageL", "tent"],
      ["shelter", "cottageR"],
      ["cottageL", "cottageR"],
    ] as const);
    return [
      place("cottageL", "cottageL", between(random, 0.9, 1.15)),
      place("cottageR", "cottageR", between(random, 0.9, 1.15)),
      place(rear[0], "shelter", between(random, 0.9, 1.1), between(random, -0.25, 0.25)),
      place(rear[1], "tent", between(random, 0.9, 1.1), between(random, -0.25, 0.25)),
    ];
  },
  1: (random, grandeur, pick) => {
    const wings = pick([["wingL", "wingR"], ["wingL", "wingR"], ["wingL"], ["wingR"]] as const);
    return [
      place("hall", "hall", between(random, 0.9, 1.1) + grandeur * 0.25),
      ...wings.map((wing) => place(wing, wing, between(random, 0.85, 1.2))),
    ];
  },
  2: (random, grandeur, pick) => {
    const [left, right] = pick([
      ["elder", "younger"],
      ["younger", "elder"],
      ["elder", "elder"],
      ["younger", "younger"],
    ] as const);
    const leftHeight = between(random, 0.85, 1.1) + grandeur * 0.2;
    const rightHeight = between(random, 0.85, 1.1) + grandeur * 0.2;
    const placements = [place(left, "elder", leftHeight), place(right, "younger", rightHeight)];
    return random() < 0.7 ? [...placements, place("bridge", "bridge", 1)] : placements;
  },
  3: (random, grandeur, pick) => {
    const towers = pick([["towerL", "towerR"], ["towerL", "towerR"], ["towerL"], ["towerR"], []] as const);
    return [
      place("palace", "palace", between(random, 0.85, 1.05) + grandeur * 0.2),
      ...towers.flatMap((tower) => {
        const bridge = tower === "towerL" ? "bridgeL" : "bridgeR";
        return [place(tower, tower, between(random, 0.8, 1.15)), place(bridge, bridge, 1)];
      }),
    ];
  },
};

const FIXED_MODULES: Record<RealmKitLevel, readonly string[]> = {
  0: ["cottageL", "cottageR", "shelter", "tent"],
  1: ["hall", "wingL", "wingR"],
  2: ["elder", "younger", "bridge"],
  3: ["palace", "towerL", "towerR", "bridgeL", "bridgeR"],
};

export function realmKitModules(level: RealmKitLevel): readonly string[] {
  return [REALM_KIT_RING, ...FIXED_MODULES[level]];
}

function fixedDesign(level: RealmKitLevel): RealmKitPlacement[] {
  return realmKitModules(level).map((module) => place(module, module, 1));
}

function place(module: string, at: string, heightScale: number, yaw = 0): RealmKitPlacement {
  return { module, at, heightScale, yaw };
}

function between(random: Random, low: number, high: number): number {
  return low + random() * (high - low);
}

/** The hyperstructures' generator, seeded per level so a Realm's four ages are not the same draw. */
function seededRandom(realmId: number, level: RealmKitLevel): Random {
  let state = foldEntityId(realmId, 0x9e3779b9 + level);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
