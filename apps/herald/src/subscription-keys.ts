import {
  scopeLookup,
  scopeInputKeys,
  gameSyncRowKeys,
  gameSyncScopeKeys,
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
  "TileOccupancy",
]);

/** The scope-input keys whose rows this scope was taken from, or would be taken from. */
export function scopeInputInterest(scope: GameSyncScope): Set<string> {
  const expedition = scope.expedition;
  if (!expedition) return new Set();
  return new Set([
    ...(scope.actor === undefined ? [] : [scopeLookup.entryOf(scope.actor)]),
    ...(scope.visit === undefined ? [] : [scopeLookup.entryOf(scope.visit)]),
    ...[...expedition.owners].map(scopeLookup.structuresOf),
    ...[...expedition.realms].map(scopeLookup.armiesOf),
    ...[...expedition.regions].map(scopeLookup.occupancyIn),
    ...[...expedition.entities].flatMap((entity) => [
      scopeLookup.structure(entity),
      scopeLookup.army(entity),
      scopeLookup.occupancyOf(entity),
    ]),
  ]);
}

/** Whether a changed row can move a scope whose input interest is `inputs`. */
export function movesSubscriptionScope(
  inputs: ReadonlySet<string>,
  row: { model: string; value: DecodedRecord },
  spacing: number | undefined,
) {
  if (SCOPE_RULE_MODELS.has(row.model)) return true;
  return inputs.size > 0 && scopeInputKeys(row.model, row.value, spacing).some((key) => inputs.has(key));
}

/** Every key a subscription with this scope is reached by. */
export function scopeStreamKeys(scope: GameSyncScope): Set<string> {
  return new Set([...gameSyncScopeKeys(scope), ...scopeInputInterest(scope)]);
}

/** The keys a changed row reaches subscriptions by, or "everyone" for a shared row or a rule every scope reads. */
export function rowStreamKeys(
  model: string,
  row: DecodedRecord,
  spacing: number | undefined,
): readonly string[] | "everyone" {
  if (SCOPE_RULE_MODELS.has(model)) return "everyone";
  const held = gameSyncRowKeys(model, row, spacing);
  return held === "shared" ? "everyone" : [...held, ...scopeInputKeys(model, row, spacing)];
}
