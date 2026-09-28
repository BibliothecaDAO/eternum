/** What a rejection the chain sends back means for the workload; every classifier reads it from here. */
export type Rejection =
  | "tile_contention"
  | "unrevealed_tile"
  | "stamina"
  | "cooldown"
  | "resource_shortfall"
  | "out_of_range"
  | "target_gone"
  | "attacker_gone"
  | "combatant_gone"
  | "immunity";

// Each rejection text the workload meets, written once and checked against the contracts' own messages; the first match
// wins, so a narrower text comes first.
const REJECTIONS: ReadonlyArray<[RegExp, Rejection]> = [
  // A move or explore lost its tile to another player first: occupied, or already revealed by someone else.
  [
    /one of the tiles in path is occupied|tile.*occupied|occupied (?:structure )?tile|destination occupied|portal landing occupied|tile already revealed/i,
    "tile_contention",
  ],
  [
    /path.*not explored|undiscovered movement tile|tile must be revealed|deployment tile unexplored/i,
    "unrevealed_tile",
  ],
  [
    /(?:insufficient|not enough|requires?).*stamina|stamina.*(?:depleted|required)|stamina, but need .* to launch attack/i,
    "stamina",
  ],
  [/before you can attack/i, "cooldown"],
  // Any missing resource, labor for a burn or wood and wheat for a build: the native world says insufficient resource
  // balance for all of them.
  [
    /(?:insufficient|not enough).*labor|labor.*(?:depleted|required)|insufficient resource balance/i,
    "resource_shortfall",
  ],
  [/(?:explorers?|structure|armies).*(?:out of range|not adjacent)|requires adjacency/i, "out_of_range"],
  [/target explorer is dead|defender has no troops/i, "target_gone"],
  [/aggressor has no troops|you have no troops|explorer is dead/i, "attacker_gone"],
  // Either side fell to another battle between the plan and the chain running it.
  [/missing explorer(?! (?:id|owner))|dead combatant/i, "combatant_gone"],
  [/immunity/i, "immunity"],
];

export function rejectionOf(message: string): Rejection | undefined {
  return REJECTIONS.find(([pattern]) => pattern.test(message))?.[1];
}
