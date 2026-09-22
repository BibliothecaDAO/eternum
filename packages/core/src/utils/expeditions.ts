import type { NativeFactStore } from "../client/native-fact-store";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";

type ExpeditionRules = NonNullable<ReturnType<typeof readExpeditionRules>>;

/** The clocks and grid a Frontier game lays its daily regions on; null for games without expeditions. */
export const readExpeditionRules = (
  store: Pick<NativeFactStore, "get" | "require">,
  gameId: number,
): { epochSeconds: number; spacing: number; startMainAt: number } | null => {
  const rules = store.get("SliceRules", { game_id: gameId });
  if (!rules || rules.epoch_seconds === 0) return null;
  return {
    epochSeconds: rules.epoch_seconds,
    spacing: store.require("SettlementRules", { game_id: gameId }).spacing,
    startMainAt: Number(store.require("GameRegistry", { game_id: gameId }).start_main_at),
  };
};

/** Days since the season's first expedition, counted on UTC epoch boundaries as the contract does. */
export const expeditionEpoch = (rules: ExpeditionRules, nowSeconds: number): number =>
  Math.floor(nowSeconds / rules.epochSeconds) - Math.floor(rules.startMainAt / rules.epochSeconds);

/** A Frontier realm keeps no map coordinate of its own: the contract parks it at a sentinel and raises it daily. */
export const isExpeditionRealm = (structure: NativeRows["Structure"]): boolean =>
  !structure.base.alt && structure.base.coord_y === 0xffffffff;

/** Where the realm stands on today's surface region: the site the contract computes for (realm, day, depth 0). */
export const expeditionRealmSite = (
  rules: ExpeditionRules,
  structure: NativeRows["Structure"],
  nowSeconds: number,
): { col: number; row: number } => {
  const half = Math.floor(rules.spacing / 2);
  const epoch = expeditionEpoch(rules, nowSeconds);
  return {
    col: (structure.metadata.realm_id - 1) * rules.spacing + half,
    row: epoch * 4 * rules.spacing + half,
  };
};
