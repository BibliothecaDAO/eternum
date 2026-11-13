import type { IconMeaning } from "@/ui/design-system/icon-meaning";
import { BOON_WORDS } from "@/ui/design-system/kit/words";

/**
 * Season 1's army boons (docs/plans/frontier-season-1.md, Army boons and XP; reports/s1-xp-3.md): nine boons under four
 * givers, five steps each. The per-step numbers are the design's first values; when the deep lane's boons land (C14,
 * P5), they are read from the generated rule constants and this table keeps only names and paintings.
 */
export const BOON_KINDS = [
  "battle",
  "charge",
  "guard",
  "vigour",
  "plunder",
  "lore",
  "camps",
  "rifts",
  "shrines",
] as const;
export type BoonKind = (typeof BOON_KINDS)[number];

/** The four givers: War gives to Knights, Paths to Scouts, Ward and Spoils to every army. */
const GIVER_ROLES = ["war", "ward", "spoils", "paths"] as const;
export type GiverRole = (typeof GIVER_ROLES)[number];
export type BoonTroop = "knight" | "scout";

/** The steps a boon holds at most; a step past them comes back as stamina. */
export const BOON_STEPS = 5;
/** The stamina a rest gives for each rank of the point, and a step past a full boon gives back. */
export const REST_STAMINA_PER_RANK = 20;

export const GIVERS = {
  war: { troops: ["knight"], boons: ["battle", "charge"] },
  ward: { troops: ["knight", "scout"], boons: ["guard", "vigour"] },
  spoils: { troops: ["knight", "scout"], boons: ["plunder", "lore"] },
  paths: { troops: ["scout"], boons: ["camps", "rifts", "shrines"] },
} as const satisfies Record<GiverRole, { troops: readonly BoonTroop[]; boons: readonly BoonKind[] }>;

/** Each boon's painting and what its steps do, as a player reads it: "+30% damage". */
export const BOONS = {
  battle: { icon: "attack", effect: (steps: number) => BOON_WORDS.percent(10 * steps, "damage") },
  charge: { icon: "strength", effect: (steps: number) => BOON_WORDS.charge(5 * steps) },
  guard: { icon: "defend", effect: (steps: number) => BOON_WORDS.less(5 * steps, "damage taken") },
  vigour: { icon: "stamina", effect: (steps: number) => BOON_WORDS.percent(10 * steps, "stamina regeneration") },
  plunder: { icon: "resources", effect: (steps: number) => BOON_WORDS.percent(10 * steps, "of what a reveal pays") },
  lore: { icon: "book", effect: (steps: number) => BOON_WORDS.percent(10 * steps, "XP") },
  camps: { icon: "camp", effect: (steps: number) => BOON_WORDS.percent(25 * steps, "camp odds") },
  rifts: { icon: "rift", effect: (steps: number) => BOON_WORDS.percent(25 * steps, "rift odds") },
  shrines: { icon: "shrine", effect: (steps: number) => BOON_WORDS.percent(15 * steps, "shrine and well odds") },
} as const satisfies Record<BoonKind, { icon: IconMeaning; effect: (steps: number) => string }>;

/** The giver a boon comes from. */
export const giverOf = (boon: BoonKind): GiverRole =>
  GIVER_ROLES.find((role) => (GIVERS[role].boons as readonly BoonKind[]).includes(boon))!;
