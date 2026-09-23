import {
  gameSyncRegion,
  gameSyncRowKeys,
  gameSyncScopeKeys,
  syncScalar,
  type GameSyncScope,
} from "@bibliothecadao/eternum/game-sync-models";
import type { DecodedRecord } from "./types";

// A changed row reaches a subscription by keys: the sync keys say who holds the row, and the scope-input keys say whose
// scope it can move. Each side is one inversion, so routing, snapshots and scope invalidation read one rule.

/** Rules every expedition scope reads: a change to one reaches every subscription. */
const SCOPE_RULE_MODELS = new Set(["SliceRules", "GameRegistry", "SettlementRules"]);

/** Every model subscriptionScope reads: a change to any other model never moves a scope. */
export const SCOPE_INPUT_MODELS = new Set([
  ...SCOPE_RULE_MODELS,
  "PlayerEntry",
  "Structure",
  "ExplorerTroops",
  "ProductionReceiver",
]);

/** The lookups subscriptionScope makes that can find this row; a region key needs the game's spacing. */
export function scopeInputKeys(model: string, row: DecodedRecord, spacing: number): string[] {
  if (model === "PlayerEntry") return [`PlayerEntry.player:${syncScalar(row.player)}`];
  if (model === "ExplorerTroops")
    return [`ExplorerTroops.owner:${syncScalar(row.owner)}`, `ExplorerTroops.entity:${syncScalar(row.explorer_id)}`];
  if (model === "ProductionReceiver")
    return [
      `ProductionReceiver.home:${syncScalar(row.home)}`,
      `ProductionReceiver.entity:${syncScalar(row.entity_id)}`,
    ];
  if (model !== "Structure") return [];
  const base = row.base as DecodedRecord;
  const region = gameSyncRegion({ alt: base.alt, x: base.coord_x, y: base.coord_y }, spacing);
  return [
    `Structure.owner:${syncScalar(row.owner)}`,
    `Structure.entity:${syncScalar(row.entity_id)}`,
    ...(region === undefined ? [] : [`Structure.region:${region}`]),
  ];
}

/** The scope-input keys whose rows this scope was taken from, or would be taken from. */
export function scopeInputInterest(scope: GameSyncScope): Set<string> {
  const expedition = scope.expedition;
  if (!expedition) return new Set();
  return new Set([
    ...(scope.actor === undefined ? [] : [`PlayerEntry.player:${syncScalar(scope.actor)}`]),
    ...[...expedition.owners].map((owner) => `Structure.owner:${owner}`),
    ...[...expedition.realms].flatMap((realm) => [`ExplorerTroops.owner:${realm}`, `ProductionReceiver.home:${realm}`]),
    ...[...expedition.regions].map((region) => `Structure.region:${region}`),
    ...[...expedition.entities].flatMap((entity) => [`Structure.entity:${entity}`, `ExplorerTroops.entity:${entity}`]),
    ...[...expedition.productionSources].map((source) => `ProductionReceiver.entity:${source}`),
  ]);
}

/** Whether a changed row can move a scope whose input interest is `inputs`. */
export function movesSubscriptionScope(
  inputs: ReadonlySet<string>,
  row: { model: string; value: DecodedRecord },
  spacing: number,
) {
  if (SCOPE_RULE_MODELS.has(row.model)) return true;
  return inputs.size > 0 && scopeInputKeys(row.model, row.value, spacing).some((key) => inputs.has(key));
}

/** Every key a subscription with this scope is reached by. */
export function scopeStreamKeys(scope: GameSyncScope): Set<string> {
  return new Set([...gameSyncScopeKeys(scope), ...scopeInputInterest(scope)]);
}

/** The keys a changed row reaches subscriptions by, or "everyone" for a shared row or a rule every scope reads. */
export function rowStreamKeys(model: string, row: DecodedRecord, spacing: number): readonly string[] | "everyone" {
  if (SCOPE_RULE_MODELS.has(model)) return "everyone";
  const held = gameSyncRowKeys(model, row, spacing);
  return held === "shared" ? "everyone" : [...held, ...scopeInputKeys(model, row, spacing)];
}
