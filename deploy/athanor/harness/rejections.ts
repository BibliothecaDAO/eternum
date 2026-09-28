/** What a rejection the chain sends back means for the workload. */
export type Rejection =
  | "tile_contention"
  | "stamina"
  | "cooldown"
  | "labor"
  | "out_of_range"
  | "target_gone"
  | "attacker_gone"
  | "combatant_gone"
  | "immunity";

// Each rejection text the workload meets, written once; the first match wins, so a narrower text comes first.
const REJECTIONS: ReadonlyArray<[RegExp, Rejection]> = [
  [/one of the tiles in path is occupied|tile.*occupied/i, "tile_contention"],
  [/stamina/i, "stamina"],
  [/before you can attack/i, "cooldown"],
  [/labor/i, "labor"],
  [/out of range|requires adjacency/i, "out_of_range"],
  [/target explorer is dead|defender has no troops/i, "target_gone"],
  [/aggressor has no troops|you have no troops|explorer is dead/i, "attacker_gone"],
  // Either side fell to another battle between the plan and the chain running it.
  [/missing explorer|dead combatant/i, "combatant_gone"],
  [/immunity/i, "immunity"],
];

export function rejectionOf(message: string): Rejection | undefined {
  return REJECTIONS.find(([pattern]) => pattern.test(message))?.[1];
}
