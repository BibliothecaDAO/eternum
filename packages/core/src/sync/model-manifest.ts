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
    epoch: number;
    spacing: number;
    owners: ReadonlySet<string>;
    realms: ReadonlySet<string>;
    entities: ReadonlySet<string>;
    productionSources: ReadonlySet<string>;
    realmTraits: ReadonlySet<string>;
    regions: ReadonlySet<string>;
  };
}

type SyncSet = "owners" | "entities" | "realms" | "realmTraits" | "productionSources";
type SyncRule =
  | "shared"
  | "actor"
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

/** Actor changes replace these rows atomically while retaining shared game configuration. */
export function isScopedGameSyncModel(model: string, expedition: boolean): boolean {
  const rule = syncRule(model);
  return rule === "actor" || (expedition && rule !== "shared");
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

const SYNC_SETS = ["owners", "entities", "realms", "realmTraits", "productionSources"] as const;

/**
 * The keys a row reaches subscriptions by, the inverse of rowInGameSyncScope: a scope holds the row exactly when the row
 * is shared or its keys meet gameSyncScopeKeys(scope). An epoch-bound row's keys carry its epoch, so only that day's
 * scope meets them; `*` is met by every scope without an expedition.
 */
export function gameSyncRowKeys(model: string, row: Record<string, unknown>, spacing: number): "shared" | string[] {
  const rule = syncRule(model);
  if (rule === "shared") return "shared";
  if (rule === "actor") return [`actor:${syncScalar(row.actor)}`];
  const epoch = rule.epoch === undefined ? "" : `@${Number(row[rule.epoch])}`;
  const keys = ["*"];
  for (const set of SYNC_SETS)
    for (const field of rule[set] ?? []) keys.push(`${set}:${syncScalar(row[field])}${epoch}`);
  for (const region of rule.regions ?? []) {
    const key = gameSyncRegion({ alt: row[region.alt], x: row[region.x], y: row[region.y] }, spacing);
    if (key !== undefined) keys.push(`regions:${key}${epoch}`);
  }
  return keys;
}

/** The keys a scope holds rows by; see gameSyncRowKeys. */
export function gameSyncScopeKeys(scope: GameSyncScope): Set<string> {
  const keys = new Set<string>();
  if (scope.actor !== undefined) keys.add(`actor:${syncScalar(scope.actor)}`);
  const expedition = scope.expedition;
  if (!expedition) return keys.add("*");
  for (const set of [...SYNC_SETS, "regions"] as const)
    for (const value of expedition[set]) keys.add(`${set}:${value}`).add(`${set}:${value}@${expedition.epoch}`);
  return keys;
}

export function rowInGameSyncScope(model: string, row: Record<string, unknown>, scope: GameSyncScope): boolean {
  const rule = syncRule(model);
  if (rule === "actor") return scope.actor !== undefined && syncScalar(row.actor) === syncScalar(scope.actor);
  const expedition = scope.expedition;
  if (!expedition || rule === "shared") return true;
  if (rule.epoch !== undefined && Number(row[rule.epoch]) !== expedition.epoch) return false;
  const named = (set: SyncSet) => (rule[set] ?? []).some((field) => expedition[set].has(syncScalar(row[field])));
  const inRegion = (rule.regions ?? []).some((region) => {
    const key = gameSyncRegion({ alt: row[region.alt], x: row[region.x], y: row[region.y] }, expedition.spacing);
    return key !== undefined && expedition.regions.has(key);
  });
  return inRegion || SYNC_SETS.some(named);
}
