import { rowInGameSyncScope, type GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";
import type { PublishedBody, SnapshotOverlayDiff } from "./game-stream";
import type { FoldDelete, FoldSet, GameSnapshot } from "./types";
import type { HomeRing } from "./home-ring";
import { movesSubscriptionScope, SCOPE_INPUT_MODELS, scopeInputInterest, scopeStreamKeys } from "./subscription-keys";
import type { ModelRegistry } from "./model-registry";
import type { WorldFold } from "./world-fold";

const identity = (row: FoldDelete) => `${row.model}:${row.key}`;
const scopeIdentity = (scope: GameSyncScope) =>
  JSON.stringify(scope, (_key, value) => (value instanceof Set ? [...value].sort() : value));

/** Replaces game-wide delivery; retains membership keys, never a second copy of current facts. */
export class GameSubscription {
  private visible = new Map<string, FoldDelete>();
  private publishedScopeKey?: string;
  private knownScope?: { scope: GameSyncScope; inputs: ReadonlySet<string>; validUntil: number };
  private interestOf?: { scope: GameSyncScope; keys: ReadonlySet<string> };
  private readonly persistentModels: ReadonlySet<string>;

  constructor(
    private readonly gameId: string,
    private readonly actor: string | undefined,
    private readonly fold: (preconfirmed: boolean) => WorldFold,
    private readonly block: () => number,
    private readonly timestamp: () => number,
    registry: ModelRegistry,
    private readonly ring?: Pick<HomeRing, "rows" | "row">,
    private readonly visit?: string,
  ) {
    this.persistentModels = new Set(
      registry.persistent
        .filter(({ definition }) => definition.deletion === "component")
        .map(({ definition }) => definition.name),
    );
  }

  public snapshot(): GameSnapshot {
    // Bootstrap from confirmed rows; subsequent rebases use the view held by the overlay ledger.
    const scope = this.scope();
    const snapshot = this.scopeSnapshot(false, scope);
    this.remember(snapshot, scope);
    return snapshot;
  }

  public overlay(diffs: SnapshotOverlayDiff[]): SnapshotOverlayDiff[] {
    return diffs
      .flatMap((diff) => this.project({ ...diff, preconfirmed: true, type: "diff" }))
      .filter((body): body is Extract<PublishedBody, { type: "diff" }> => body.type === "diff");
  }

  public get expedition(): boolean {
    return this.scope().expedition !== undefined;
  }

  /** Every key that reaches the scope subscribers currently hold. */
  public interest(): ReadonlySet<string> {
    const scope = this.scope();
    if (this.interestOf?.scope !== scope) this.interestOf = { scope, keys: scopeStreamKeys(scope) };
    return this.interestOf.keys;
  }

  public project(body: PublishedBody): PublishedBody[] {
    this.forgetMovedScope(body);
    if (body.type === "overlay_reset") return [body];
    if (body.type === "tx") {
      const executions = body.executions?.filter(
        (outcome) => this.actor !== undefined && BigInt(outcome.actor) === BigInt(this.actor),
      );
      return [{ ...body, ...(executions ? { executions } : {}) }];
    }
    const scope = this.scope();
    if (this.publishedScopeKey !== scopeIdentity(scope)) return this.replaceScope(body, scope);
    if (body.type === "head") return [body];
    const set = body.set.filter(
      (row) => rowInGameSyncScope(row.model, row.value, scope) && !this.repeatsShownRingRow(row),
    );
    const del = body.del.filter((row) => this.visible.has(identity(row)));
    this.track(set, del);
    return set.length || del.length ? [{ ...body, set, del }] : [];
  }

  private scope(): GameSyncScope {
    const timestamp = this.timestamp();
    const known = this.knownScope;
    if (known && timestamp < known.validUntil) return known.scope;
    const fold = this.fold(true);
    const scope = fold.subscriptionScope(this.gameId, this.actor, timestamp, this.visit);
    this.knownScope = {
      scope,
      inputs: scopeInputInterest(scope),
      validUntil: fold.scopeValidUntil(this.gameId, timestamp),
    };
    return scope;
  }

  /**
   * The published change is already in the fold: forget any scope it can have moved. An overlay reset needs nothing
   * here: what it reverts or confirms is published as diffs of its own.
   */
  private forgetMovedScope(body: PublishedBody): void {
    if (body.type !== "diff" || !this.knownScope) return;
    const { scope, inputs } = this.knownScope;
    const moved =
      body.set.some((row) => movesSubscriptionScope(inputs, row, scope.expedition?.spacing)) ||
      body.del.some((row) => SCOPE_INPUT_MODELS.has(row.model) && this.visible.has(identity(row)));
    if (moved) this.knownScope = undefined;
  }

  private replaceScope(body: Extract<PublishedBody, { type: "diff" | "head" }>, scope: GameSyncScope): PublishedBody[] {
    const snapshot = this.scopeSnapshot(true, scope);
    const set = snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ ...row, model })));
    const next = new Set(set.map(identity));
    const del = [...this.visible.entries()].filter(([key]) => !next.has(key)).map(([, row]) => row);
    // Events are not snapshot rows; keep this receipt's scoped ephemera beside its atomic state update.
    if (body.type === "diff")
      for (const row of body.set)
        if (!this.persistentModels.has(row.model) && rowInGameSyncScope(row.model, row.value, scope)) set.push(row);
    this.publishedScopeKey = scopeIdentity(scope);
    this.track(set, del);
    const diff: PublishedBody = {
      type: "diff",
      block: body.block,
      preconfirmed: body.preconfirmed,
      set,
      del,
      ...(body.type === "diff" && body.transaction_hash ? { transaction_hash: body.transaction_hash } : {}),
    };
    return body.type === "head" ? [diff, body] : [diff];
  }

  private remember(snapshot: GameSnapshot, scope: GameSyncScope): void {
    this.visible.clear();
    for (const { model, rows } of snapshot.models)
      for (const row of rows) this.visible.set(identity({ model, key: row.key }), { model, key: row.key });
    this.publishedScopeKey = scopeIdentity(scope);
  }

  private track(set: FoldSet[], del: FoldDelete[]): void {
    for (const row of set)
      if (this.persistentModels.has(row.model)) this.visible.set(identity(row), { model: row.model, key: row.key });
    for (const row of del) this.visible.delete(identity(row));
  }

  /** The fold's snapshot for this scope, with the home-ring tiles the chain has not written yet. */
  private scopeSnapshot(preconfirmed: boolean, scope: GameSyncScope): GameSnapshot {
    const snapshot = this.fold(preconfirmed).subscriptionSnapshot(this.gameId, this.block(), scope);
    const ring = (this.ring?.rows(this.gameId, scope, this.timestamp()) ?? []).filter((row) =>
      rowInGameSyncScope(row.model, row.value, scope),
    );
    const tiles = snapshot.models.find(({ model }) => model === RING_MODEL);
    const written = new Set(tiles?.rows.map(({ key }) => key));
    // A tile the chain has written is a fact of the fold; the rule's copy of it is never shown beside it.
    const unwritten = ring.filter(({ key }) => !written.has(key)).map(({ key, value }) => ({ key, value }));
    if (unwritten.length === 0) return snapshot;
    const models = tiles
      ? snapshot.models.map((entry) => (entry === tiles ? { ...entry, rows: [...entry.rows, ...unwritten] } : entry))
      : [...snapshot.models, { model: RING_MODEL, rows: unwritten }];
    return { ...snapshot, models };
  }

  /** The chain writing a ring tile this subscription already shows, with the same value, changes nothing for it. */
  private repeatsShownRingRow(row: FoldSet): boolean {
    const ringRow = this.ring?.row(row.key);
    return (
      ringRow !== undefined &&
      this.visible.has(identity(row)) &&
      JSON.stringify(ringRow.value) === JSON.stringify(row.value)
    );
  }
}

const RING_MODEL = "TileOpt";
