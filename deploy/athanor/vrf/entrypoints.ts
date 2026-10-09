// Public Games writes share one endpoint; their owner/launcher/ledger-operator authorization lives in the contract.
// Roster permutation and other draws execute through play, never through an unstamped administrative route.
export const GAME_ENTRYPOINTS = [
  { name: "play", stamp: true },
  { name: "create_game", stamp: false },
  { name: "freeze_blitz_roster", stamp: false },
  { name: "prepare_homes", stamp: false },
  { name: "apply_release", stamp: false },
  { name: "register_release", stamp: false },
  { name: "register_preset", stamp: false },
  { name: "set_launcher", stamp: false },
  { name: "set_ledger_operator", stamp: false },
  { name: "grant_labor", stamp: false },
  { name: "register_entitlement", stamp: false },
  { name: "register_village_pass", stamp: false },
] as const;
