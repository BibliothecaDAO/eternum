import { nativeGamesWrites } from "../../../contracts/l3/world-native/schema/commands.gen";

type GamesWrite = (typeof nativeGamesWrites)[number];
type Route = "stamped" | "admin" | "refused";

const ROUTES = {
  play: "stamped",
  create_game: "admin",
  apply_release: "admin",
  open_release: "admin",
  register_release: "admin",
  set_launcher: "admin",
  set_ledger_operator: "admin",
  grant_seal: "admin",
  credit_fragments: "admin",
  register_entitlement: "admin",
  register_village_pass: "admin",
  authority_call: "refused",
  initialize_realm_traits: "refused",
  deliver_deposit: "refused",
  sweep_lords: "refused",
} as const satisfies Record<GamesWrite, Route>;

type Routed<R extends Route> = { [Name in GamesWrite]: (typeof ROUTES)[Name] extends R ? Name : never }[GamesWrite];

/** A Games write the proxy forwards: `play`, which it stamps, or an administrative call. */
export type GameEntrypointName = Routed<"stamped" | "admin">;
/** An administrative Games write the proxy forwards unstamped. */
export type AdminEntrypointName = Routed<"admin">;

export const GAME_ENTRYPOINTS = nativeGamesWrites
  .filter((name): name is GameEntrypointName => ROUTES[name] !== "refused")
  .map((name) => ({ name, stamp: ROUTES[name] === "stamped" }));
