import { rowInGameSyncScope, type GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";
import type { PublishedBody, SnapshotOverlayDiff } from "./game-stream";
import type { FoldDelete, FoldSet, GameSnapshot } from "./types";
import type { HomeRing } from "./home-ring";
import { movesSubscriptionScope, SCOPE_INPUT_MODELS, scopeInputInterest, scopeStreamKeys } from "./subscription-keys";
import type { WorldFold } from "./world-fold";

const identity = (row: FoldDelete) => `${row.model}:${row.key}`;
const scopeIdentity = (scope: GameSyncScope) =>
  JSON.stringify(scope, (_key, value) => (value instanceof Set ? [...value].sort() : value));

/** Replaces game-wide delivery; retains membership keys, never a second copy of current facts. */
export class GameSubscription {
  private visible = new Map<string, FoldDelete>();
  private scopeKey = "";
  private rememberedScope?: GameSyncScope;
  /**
   * The scope per fold (confirmed, pre-confirmed) with the scope-input keys it was taken from, kept until a published
   * change reaches one of those keys or the day's expedition rolls over.
   */
  private readonly scopes = new Map<
    boolean,
    { scope: GameSyncScope; inputs: ReadonlySet<string>; validUntil: number }
  >();
  private interestOf?: { confirmed: GameSyncScope; preconfirmed: GameSyncScope; keys: ReadonlySet<string> };

  constructor(
    private readonly gameId: string,
    private readonly actor: string | undefined,
    private readonly fold: (preconfirmed: boolean) => WorldFold,
    private readonly block: () => number,
    private readonly timestamp: () => number,
    private readonly ring?: Pick<HomeRing, "rows" | "row">,
    private readonly visit?: string,
  ) {}

  public snapshot(): GameSnapshot {
    const scope = this.scope(false);
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
    return this.scope(false).expedition !== undefined;
  }

  /** Every key a published row can reach this subscription by, under either fold's scope. */
  public interest(): ReadonlySet<string> {
    const [confirmed, preconfirmed] = [this.scope(false), this.scope(true)];
    if (this.interestOf?.confirmed !== confirmed || this.interestOf.preconfirmed !== preconfirmed) {
      const keys = new Set([...scopeStreamKeys(confirmed), ...scopeStreamKeys(preconfirmed)]);
      this.interestOf = { confirmed, preconfirmed, keys };
    }
    return this.interestOf.keys;
  }

  public project(body: PublishedBody): PublishedBody[] {
    this.forgetMovedScopes(body);
    if (body.type === "overlay_reset") return [body];
    if (body.type === "tx") {
      const executions = body.executions?.filter(
        (outcome) => this.actor !== undefined && BigInt(outcome.actor) === BigInt(this.actor),
      );
      return [{ ...body, ...(executions ? { executions } : {}) }];
    }
    const preconfirmed = body.type === "head" || body.preconfirmed;
    const scope = this.scope(preconfirmed);
    if (scope !== this.rememberedScope && scopeIdentity(scope) !== this.scopeKey)
      return this.replaceScope(body, scope, preconfirmed);
    if (body.type === "head") return [body];
    const set = body.set.filter(
      (row) => rowInGameSyncScope(row.model, row.value, scope) && !this.repeatsShownRingRow(row),
    );
    const del = body.del.filter((row) => this.visible.has(identity(row)));
    this.track(set, del);
    return set.length || del.length ? [{ ...body, set, del }] : [];
  }

  private scope(preconfirmed: boolean): GameSyncScope {
    const timestamp = this.timestamp();
    const known = this.scopes.get(preconfirmed);
    if (known && timestamp < known.validUntil) return known.scope;
    const fold = this.fold(preconfirmed);
    const scope = fold.subscriptionScope(this.gameId, this.actor, timestamp, this.visit);
    this.scopes.set(preconfirmed, {
      scope,
      inputs: scopeInputInterest(scope),
      validUntil: fold.scopeValidUntil(this.gameId, timestamp),
    });
    return scope;
  }

  /**
   * The published change is already in the fold: forget any scope it can have moved. An overlay reset needs nothing
   * here: what it reverts or confirms is published as diffs of its own.
   */
  private forgetMovedScopes(body: PublishedBody): void {
    if (body.type !== "diff") return;
    for (const [preconfirmed, { scope, inputs }] of this.scopes) {
      const spacing = scope.expedition?.spacing;
      const moved =
        body.set.some((row) => movesSubscriptionScope(inputs, row, spacing)) ||
        body.del.some((row) => SCOPE_INPUT_MODELS.has(row.model) && this.visible.has(identity(row)));
      // A confirmed change also shows through the pre-confirmed fold, which reads from it.
      if (moved) {
        this.scopes.delete(preconfirmed);
        if (!body.preconfirmed) this.scopes.delete(true);
      }
    }
  }

  private replaceScope(
    body: Extract<PublishedBody, { type: "diff" | "head" }>,
    scope: GameSyncScope,
    preconfirmed: boolean,
  ): PublishedBody[] {
    const snapshot = this.scopeSnapshot(preconfirmed, scope);
    const set = snapshot.models.flatMap(({ model, rows }) => rows.map((row) => ({ ...row, model })));
    const next = new Set(set.map(identity));
    const del = [...this.visible.entries()].filter(([key]) => !next.has(key)).map(([, row]) => row);
    // Events are not snapshot rows; keep this receipt's scoped ephemera beside its atomic state update.
    if (body.type === "diff")
      for (const row of body.set)
        if (!next.has(identity(row)) && rowInGameSyncScope(row.model, row.value, scope)) set.push(row);
    this.remember(snapshot, scope);
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
    this.scopeKey = scopeIdentity(scope);
    this.rememberedScope = scope;
  }

  private track(set: FoldSet[], del: FoldDelete[]): void {
    for (const row of set)
      if (this.fold(true).currentRow(row.model, row.key) || this.ring?.row(row.key))
        this.visible.set(identity(row), { model: row.model, key: row.key });
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
