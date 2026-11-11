// Public Games writes share one endpoint; their owner/launcher/ledger-operator authorization lives in the contract.
// Roster permutation and other draws execute through play, never through an unstamped administrative route.
// The shard proxy admits only these (deploy/athanor/vrf/transaction.ts), and ShardOperator sends only these, so a
// write the proxy would refuse does not compile.
export const GAME_ENTRYPOINTS = [
  { name: "play", stamp: true },
  { name: "create_game", stamp: false },
  { name: "apply_release", stamp: false },
  { name: "register_release", stamp: false },
  { name: "register_preset", stamp: false },
  { name: "set_launcher", stamp: false },
  { name: "set_ledger_operator", stamp: false },
  { name: "grant_labor", stamp: false },
  { name: "publish_frontier_pool", stamp: false },
  { name: "configure_deposits", stamp: false },
  { name: "deliver_deposit", stamp: false },
  { name: "sweep_lords", stamp: false },
  { name: "post_frontier_top", stamp: false },
  { name: "award_frontier_prize", stamp: false },
  { name: "sweep_lords", stamp: false },
  { name: "register_entitlement", stamp: false },
  { name: "register_village_pass", stamp: false },
] as const;

type GameEntrypoint = (typeof GAME_ENTRYPOINTS)[number];
/** A Games write the proxy forwards: `play`, which it stamps, or an administrative call. */
export type GameEntrypointName = GameEntrypoint["name"];
/** An administrative Games write the proxy forwards unstamped. */
export type AdminEntrypointName = Extract<GameEntrypoint, { stamp: false }>["name"];
