import { nativeSyncScopes } from "../../../../contracts/l3/world-native/schema/client.gen";

/** Schema-derived classification shared by Herald and the client transport. */
export interface GameSyncModelDefinition {
  name: string;
  scope: "game" | "deployment";
  deletion: "component" | "event-ephemeral";
}

export interface GameSyncScope {
  actor?: string;
  expedition?: {
    absoluteEpoch: number;
    spacing: number;
    owners: ReadonlySet<string>;
    realms: ReadonlySet<string>;
    entities: ReadonlySet<string>;
    realmTraits: ReadonlySet<string>;
    regions: ReadonlySet<string>;
  };
}

type SyncSet = "owners" | "entities" | "realms" | "realmTraits";
type SyncRule =
  | "shared"
  | "actor"
  | "internal"
  | ({ readonly [set in SyncSet]?: readonly string[] } & {
      readonly regions?: readonly { readonly alt: string; readonly x: string; readonly y: string }[];
      readonly epoch?: string;
    });

const syncRules = nativeSyncScopes as Readonly<Record<string, SyncRule>>;

/** Generation guarantees every schema fact has a rule; only a name outside the schema can miss. */
function syncRule(model: string): SyncRule {
  const rule = syncRules[model];
  if (!rule) throw new Error(`No subscription scope for ${model}`);
  return rule;
}

export function isClientGameSyncModel(model: string): boolean {
  return syncRule(model) !== "internal";
}

/** Actor changes replace these rows atomically while retaining shared game configuration. */
export function isScopedGameSyncModel(model: string, expedition: boolean): boolean {
  const rule = syncRule(model);
  return rule === "actor" || (expedition && typeof rule !== "string");
}

/** Only these model rules depend on the expedition clock and derived entity scope. */
export function isExpeditionScopedModel(model: string): boolean {
  return typeof syncRule(model) !== "string";
}

export function syncScalar(value: unknown): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint")
    throw new Error("Sync scope requires a scalar identity");
  return BigInt(value).toString();
}

export function gameSyncRegion(coord: Record<string, unknown>, spacing: number): string | undefined {
  if (coord.alt === true) return undefined;
  return `${Math.floor(Number(coord.x) / spacing)}:${Math.floor(Number(coord.y) / spacing)}`;
}

const SYNC_SETS = ["owners", "entities", "realms", "realmTraits"] as const;

/**
 * The keys a row reaches subscriptions by: a scope holds the row exactly when the row is shared or its keys meet
 * gameSyncScopeKeys(scope). An epoch-bound row's keys carry its epoch, so only that day's scope meets them; `*` is met
 * by every scope without an expedition. Region keys need the expedition spacing; with none, a row has no region key.
 */
export function gameSyncRowKeys(
  model: string,
  row: Record<string, unknown>,
  spacing: number | undefined,
): "shared" | string[] {
  const rule = syncRule(model);
  if (rule === "internal") return [];
  if (rule === "shared") return "shared";
  if (rule === "actor") return [`actor:${syncScalar(row.actor)}`];
  const epoch = rule.epoch === undefined ? "" : `@${Number(row[rule.epoch])}`;
  const keys = ["*"];
  for (const set of SYNC_SETS)
    for (const field of rule[set] ?? []) keys.push(`${set}:${syncScalar(row[field])}${epoch}`);
  if (spacing === undefined) return keys;
  for (const region of rule.regions ?? []) {
    const key = gameSyncRegion({ alt: row[region.alt], x: row[region.x], y: row[region.y] }, spacing);
    if (key !== undefined) keys.push(`regions:${key}${epoch}`);
  }
  return keys;
}

/** The `*` rule: a scope without an expedition holds every row that is not an actor's own. */
const holdsEveryScopedRow = (scope: GameSyncScope): boolean => scope.expedition === undefined;

const scopeKeysByScope = new WeakMap<GameSyncScope, Set<string>>();

/** The keys a scope holds rows by; see gameSyncRowKeys. A scope is immutable, so its keys are built once. */
export function gameSyncScopeKeys(scope: GameSyncScope): ReadonlySet<string> {
  const known = scopeKeysByScope.get(scope);
  if (known) return known;
  const keys = new Set<string>();
  if (scope.actor !== undefined) keys.add(`actor:${syncScalar(scope.actor)}`);
  const expedition = scope.expedition;
  if (holdsEveryScopedRow(scope)) keys.add("*");
  else if (expedition)
    for (const set of [...SYNC_SETS, "regions"] as const)
      for (const value of expedition[set])
        keys.add(`${set}:${value}`).add(`${set}:${value}@${expedition.absoluteEpoch}`);
  scopeKeysByScope.set(scope, keys);
  return keys;
}

/**
 * One membership rule, read from both ends: the row's keys against the scope's. The `*` rule answers first, since it
 * is how every Blitz subscription holds each row a diff routes to it.
 */
export function rowInGameSyncScope(model: string, row: Record<string, unknown>, scope: GameSyncScope): boolean {
  const rule = syncRule(model);
  if (rule === "internal") return false;
  if (rule !== "actor" && holdsEveryScopedRow(scope)) return true;
  const keys = gameSyncRowKeys(model, row, scope.expedition?.spacing);
  if (keys === "shared") return true;
  const held = gameSyncScopeKeys(scope);
  return keys.some((key) => held.has(key));
}

export { deriveGameSyncScope, scopeInputKeys, scopeLookup } from "./subscription-scope";
