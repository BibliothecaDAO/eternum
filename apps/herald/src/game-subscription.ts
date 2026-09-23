import { rowInGameSyncScope, type GameSyncScope } from "@bibliothecadao/eternum/game-sync-models";
import type { PublishedBody, SnapshotOverlayDiff } from "./game-stream";
import type { FoldDelete, FoldSet, GameSnapshot } from "./types";
import { SCOPE_INPUT_MODELS, touchesSubscriptionScope, type WorldFold } from "./world-fold";

const identity = (row: FoldDelete) => `${row.model}:${row.key}`;
const scopeIdentity = (scope: GameSyncScope) =>
  JSON.stringify(scope, (_key, value) => (value instanceof Set ? [...value].sort() : value));

/** Replaces game-wide delivery; retains membership keys, never a second copy of current facts. */
export class GameSubscription {
  private visible = new Map<string, FoldDelete>();
  private scopeKey = "";
  private rememberedScope?: GameSyncScope;
  /**
   * The scope per fold (confirmed, pre-confirmed), kept until a published change touches a row it was taken from or
   * the day's expedition rolls over. Taking it scans the game, so it is never taken per message.
   */
  private readonly scopes = new Map<boolean, { scope: GameSyncScope; validUntil: number }>();

  constructor(
    private readonly gameId: string,
    private readonly actor: string | undefined,
    private readonly fold: (preconfirmed: boolean) => WorldFold,
    private readonly block: () => number,
    private readonly timestamp: () => number,
  ) {}

  public snapshot(): GameSnapshot {
    const scope = this.scope(false);
    const snapshot = this.fold(false).subscriptionSnapshot(this.gameId, this.block(), scope);
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
    const set = body.set.filter((row) => rowInGameSyncScope(row.model, row.value, scope));
    const del = body.del.filter((row) => this.visible.has(identity(row)));
    this.track(set, del);
    return set.length || del.length ? [{ ...body, set, del }] : [];
  }

  private scope(preconfirmed: boolean): GameSyncScope {
    const timestamp = this.timestamp();
    const known = this.scopes.get(preconfirmed);
    if (known && timestamp < known.validUntil) return known.scope;
    const fold = this.fold(preconfirmed);
    const scope = fold.subscriptionScope(this.gameId, this.actor, timestamp);
    this.scopes.set(preconfirmed, { scope, validUntil: fold.scopeValidUntil(this.gameId, timestamp) });
    return scope;
  }

  /**
   * The published change is already in the fold: forget any scope it can have moved. An overlay reset needs nothing
   * here: what it reverts or confirms is published as diffs of its own.
   */
  private forgetMovedScopes(body: PublishedBody): void {
    if (body.type !== "diff") return;
    for (const [preconfirmed, { scope }] of this.scopes) {
      const moved =
        body.set.some((row) => touchesSubscriptionScope(scope, row)) ||
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
    const snapshot = this.fold(preconfirmed).subscriptionSnapshot(this.gameId, this.block(), scope);
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
      if (this.fold(true).currentRow(row.model, row.key))
        this.visible.set(identity(row), { model: row.model, key: row.key });
    for (const row of del) this.visible.delete(identity(row));
  }
}
