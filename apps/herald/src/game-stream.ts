import { isScopedGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { randomUUID } from "node:crypto";
import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { GameFinalizedError } from "./world-fold";

import type { FoldSet, GameSnapshot } from "./types";
import type { HeraldStreamMessage, ResumeRequest } from "./stream-protocol";

const RING_MIN_MESSAGES = 10_000;
const RING_MIN_AGE_MS = 10 * 60 * 1_000;

export interface StreamSocket {
  send(data: string): unknown;
  close?(code?: number, reason?: string): void;
}

interface RingEntry {
  recordedAt: number;
  seq: number;
  serialized: string;
}

interface GameStreamState {
  actor?: string;
  gameId: string;
  project?: (body: PublishedBody) => PublishedBody[];
  /** The keys a published row reaches this state by; without it, every row does. */
  interest?: () => ReadonlySet<string>;
  indexed?: ReadonlySet<string>;
  ring: RingEntry[];
  seq: number;
  subscribers: Set<GameStreamSession>;
  /** When the last subscriber left. A reconnect within a ring window still resumes; after it the state is dropped. */
  idleSince?: number;
}

/** One game's stream states, indexed by the keys their subscriptions are reached by. */
interface GameStreams {
  states: Map<string, GameStreamState>;
  byKey: Map<string, Set<GameStreamState>>;
  /** States without an interest: every published row reaches them. */
  unindexed: Set<GameStreamState>;
}

/** The keys a published row reaches stream states by, or "everyone". */
export type RowStreamKeys = (row: FoldSet) => readonly string[] | "everyone";

export interface SnapshotOverlayDiff {
  block: number | null;
  del: Extract<HeraldStreamMessage, { type: "diff" }>["del"];
  set: Extract<HeraldStreamMessage, { type: "diff" }>["set"];
  transaction_hash?: string;
}

type PublishedMessage = Extract<HeraldStreamMessage, { type: "diff" | "overlay_reset" | "tx" | "head" }>;
type PublishBody<Message> = Message extends unknown ? Omit<Message, "epoch" | "seq"> : never;
export type PublishedBody = PublishBody<PublishedMessage>;

export interface GameStreamSession {
  actor?: string;
  active: boolean;
  boundary: number;
  gameId: string;
  overlay?: SnapshotOverlayDiff[];
  snapshot?: GameSnapshot;
  socket: StreamSocket;
  traffic: SubscriberTraffic;
}

/** What one subscriber was sent, for the capacity campaign's per-subscriber bandwidth. */
interface SubscriberTraffic {
  attachedAt: number;
  bytes: number;
  frames: number;
  snapshots: number;
}

interface AttachInput {
  actor?: string;
  expedition?: boolean;
  project?: (body: PublishedBody) => PublishedBody[];
  interest?: () => ReadonlySet<string>;
  confirmedBlock: number;
  gameId: string;
  preconfirmedBlock: number | null;
  overlay: () => SnapshotOverlayDiff[];
  snapshot: () => GameSnapshot;
  socket: StreamSocket;
}

/** No subscriber has been back for a ring window: nobody can resume from this ring any more. */
const isAbandoned = (state: GameStreamState): boolean =>
  state.idleSince !== undefined && Date.now() - state.idleSince > RING_MIN_AGE_MS;

export class GameStreamHub {
  public readonly epoch: string;
  private readonly games = new Map<string, GameStreams>();

  constructor(
    epoch: string = randomUUID(),
    private readonly log: Pick<Console, "info"> = console,
  ) {
    this.epoch = epoch;
  }

  public attach(input: AttachInput): GameStreamSession {
    const state = this.game(input);
    const session: GameStreamSession = {
      actor: input.actor,
      active: false,
      boundary: state.seq,
      gameId: input.gameId,
      socket: input.socket,
      traffic: { attachedAt: Date.now(), bytes: 0, frames: 0, snapshots: 0 },
    };
    state.subscribers.add(session);
    state.idleSince = undefined;
    try {
      session.snapshot = input.snapshot();
      session.overlay = input.overlay();
    } catch (error) {
      this.leave(session);
      throw error;
    }
    this.send(session, {
      confirmed_block: input.confirmedBlock,
      epoch: this.streamEpoch(input.gameId, input.actor),
      preconfirmed_block: input.preconfirmedBlock,
      seq: session.boundary,
      type: "hello",
    });
    return session;
  }

  public resume(session: GameStreamSession, request: ResumeRequest): void {
    if (session.active) throw new Error("Stream session already resumed");
    const state = this.stateOf(session.gameId, session.actor)!;
    const canResume = this.canResume(state, request);
    const resumeFrom = canResume ? request.seq : session.boundary;

    if (!canResume) this.sendSnapshot(session);

    session.active = true;
    // The boundary is only needed until the session is live; keeping it would hold a snapshot per subscriber.
    session.snapshot = undefined;
    session.overlay = undefined;
    for (const entry of state.ring) {
      if (entry.seq > resumeFrom) this.transmit(session, entry.serialized);
    }
  }

  public detach(session: GameStreamSession): void {
    this.leave(session);
    const { attachedAt, ...traffic } = session.traffic;
    this.log.info(
      JSON.stringify({
        ...traffic,
        connectedMs: Date.now() - attachedAt,
        event: "herald_subscriber_traffic",
        gameId: session.gameId,
      }),
    );
  }

  private leave(session: GameStreamSession): void {
    const state = this.stateOf(session.gameId, session.actor);
    if (!state?.subscribers.delete(session) || state.subscribers.size > 0) return;
    state.idleSince = Date.now();
  }

  public selectActor(session: GameStreamSession, input: AttachInput): void {
    if (!session.active) throw new Error("Resume before selecting an actor");
    const state = this.game(input);
    const snapshot = input.snapshot();
    const overlay = input.overlay();
    this.leave(session);
    session.actor = input.actor;
    session.boundary = state.seq;
    state.subscribers.add(session);
    const sent = this.measure(session);
    this.send(session, {
      type: "scope",
      epoch: this.streamEpoch(input.gameId, input.actor),
      seq: state.seq,
      actor: input.actor,
      expedition: input.expedition === true,
      set: snapshot.models.flatMap(({ model, rows }) =>
        isScopedGameSyncModel(model, input.expedition === true) ? rows.map((row) => ({ ...row, model })) : [],
      ),
    });
    for (const diff of overlay)
      this.send(session, {
        ...diff,
        type: "diff",
        preconfirmed: true,
        epoch: this.streamEpoch(input.gameId, input.actor),
        seq: state.seq,
      });
    this.logSnapshotSent(session, "scope", sent);
  }

  /** With `rowKeys`, a diff reaches only the states its rows name; deletes carry no values, so they reach every state. */
  public publishDiff(
    gameId: string,
    input: Omit<Extract<HeraldStreamMessage, { type: "diff" }>, "epoch" | "seq" | "type">,
    rowKeys?: RowStreamKeys,
  ): void {
    const game = this.games.get(gameId);
    if (!game) return;
    const named = rowKeys && input.del.length === 0 ? this.named(game, input.set, rowKeys) : undefined;
    this.publish(gameId, { ...input, type: "diff" }, named);
  }

  public publishOverlayReset(gameId: string, confirmedBlock: number): void {
    this.publish(gameId, { confirmed_block: confirmedBlock, type: "overlay_reset" });
  }

  public publishTransaction(
    gameId: string,
    input: Omit<Extract<HeraldStreamMessage, { type: "tx" }>, "epoch" | "seq" | "type">,
    actors: readonly string[],
  ): void {
    const states = actors.flatMap((actor) => this.stateOf(gameId, actor) ?? []);
    this.publish(gameId, { ...input, type: "tx" }, new Set(states));
  }

  /** A confirmed head, or with `preconfirmed` the sequencer clock read off the pre-confirmed block. */
  public publishHead(gameId: string, block: number, timestamp: number, preconfirmed = false): void {
    this.publish(gameId, { block, preconfirmed, timestamp, type: "head" });
  }

  /** Publishes to these states, or to every current state of the game. */
  private publish(gameId: string, body: PublishedBody, recipients?: Iterable<GameStreamState>): void {
    const game = this.games.get(gameId);
    if (!game) return;
    for (const state of recipients ?? this.currentStates(game)) {
      let projections: PublishedBody[];
      try {
        projections = state.project ? state.project(body) : [body];
      } catch (error) {
        // One stream that cannot be served ends by name; the publish to every other stream goes on.
        this.end(game, state, error);
        continue;
      }
      for (const projected of projections) {
        const message = { ...projected, epoch: this.streamEpoch(state.gameId, state.actor), seq: ++state.seq };
        const serialized = JSON.stringify(message);
        state.ring.push({ recordedAt: Date.now(), seq: message.seq, serialized });
        this.pruneRing(state);
        for (const subscriber of state.subscribers) if (subscriber.active) this.transmit(subscriber, serialized);
      }
      // Projecting can move a scope, and with it the keys that reach this state.
      this.index(game, state);
    }
  }

  /** Drops a stream state and closes its subscribers with the reason, as a failed attach is closed. */
  private end(game: GameStreams, state: GameStreamState, error: unknown): void {
    const finalized = error instanceof GameFinalizedError;
    const reason = finalized
      ? "game_finalized"
      : (error instanceof Error ? error.message : String(error)).slice(0, 120);
    this.log.info(
      JSON.stringify({ event: "herald_stream_ended", gameId: state.gameId, actor: state.actor ?? null, reason }),
    );
    game.states.delete(this.streamKey(state.gameId, state.actor));
    game.unindexed.delete(state);
    this.unindex(game, state);
    for (const subscriber of state.subscribers)
      subscriber.socket.close?.(finalized ? HERALD_GAME_FINALIZED_CLOSE : 1011, reason);
  }

  /** The states a diff's rows name, or undefined when a row is for everyone. */
  private named(game: GameStreams, rows: readonly FoldSet[], rowKeys: RowStreamKeys): Set<GameStreamState> | undefined {
    const named = new Set(game.unindexed);
    for (const row of rows) {
      const keys = rowKeys(row);
      if (keys === "everyone") return undefined;
      for (const key of keys) for (const state of game.byKey.get(key) ?? []) named.add(state);
    }
    return named;
  }

  /** The game's states, less those nobody can resume any more. */
  private currentStates(game: GameStreams): GameStreamState[] {
    for (const [key, state] of game.states) {
      if (!isAbandoned(state)) continue;
      game.states.delete(key);
      game.unindexed.delete(state);
      this.unindex(game, state);
    }
    return [...game.states.values()];
  }

  private index(game: GameStreams, state: GameStreamState): void {
    if (!state.interest) return;
    const keys = state.interest();
    if (keys === state.indexed) return;
    this.unindex(game, state);
    for (const key of keys) {
      const states = game.byKey.get(key) ?? new Set();
      states.add(state);
      game.byKey.set(key, states);
    }
    state.indexed = keys;
  }

  private unindex(game: GameStreams, state: GameStreamState): void {
    for (const key of state.indexed ?? []) {
      const states = game.byKey.get(key);
      states?.delete(state);
      if (states?.size === 0) game.byKey.delete(key);
    }
    state.indexed = undefined;
  }

  private stateOf(gameId: string, actor?: string): GameStreamState | undefined {
    return this.games.get(gameId)?.states.get(this.streamKey(gameId, actor));
  }

  private streamEpoch(gameId: string, actor?: string): string {
    return `${this.epoch}:${gameId}:${actor === undefined ? "" : BigInt(actor).toString()}`;
  }

  private streamKey(gameId: string, actor?: string): string {
    return `${gameId}:${actor === undefined ? "" : BigInt(actor).toString()}`;
  }

  private game(input: AttachInput): GameStreamState {
    const game = this.games.get(input.gameId) ?? { states: new Map(), byKey: new Map(), unindexed: new Set() };
    this.games.set(input.gameId, game);
    const key = this.streamKey(input.gameId, input.actor);
    let state = game.states.get(key);
    if (!state) {
      state = {
        actor: input.actor,
        gameId: input.gameId,
        project: input.project,
        interest: input.interest,
        ring: [],
        seq: 0,
        subscribers: new Set(),
      };
      game.states.set(key, state);
      if (state.interest) this.index(game, state);
      else game.unindexed.add(state);
    }
    return state;
  }

  private canResume(state: GameStreamState, request: ResumeRequest): boolean {
    if (
      request.epoch !== this.streamEpoch(state.gameId, state.actor) ||
      !Number.isSafeInteger(request.seq) ||
      request.seq < 0
    )
      return false;
    if (request.seq > state.seq) return false;
    const oldest = state.ring[0]?.seq ?? state.seq + 1;
    return request.seq >= oldest - 1;
  }

  private sendSnapshot(session: GameStreamSession): void {
    if (!session.snapshot) throw new Error("Stream session has no snapshot boundary");
    const sent = this.measure(session);
    for (const model of session.snapshot.models) {
      this.send(session, {
        epoch: this.streamEpoch(session.gameId, session.actor),
        model: model.model,
        rows: model.rows,
        seq: session.boundary,
        type: "snapshot",
      });
    }
    this.send(session, {
      epoch: this.streamEpoch(session.gameId, session.actor),
      seq: session.boundary,
      type: "snapshot_end",
    });
    for (const overlay of session.overlay ?? []) {
      this.send(session, {
        ...overlay,
        epoch: this.streamEpoch(session.gameId, session.actor),
        preconfirmed: true,
        seq: session.boundary,
        type: "diff",
      });
    }
    this.logSnapshotSent(session, "snapshot", sent);
  }

  /** The traffic counters as they stand, so a snapshot's own frames and bytes can be told apart afterwards. */
  private measure(session: GameStreamSession) {
    return { bytes: session.traffic.bytes, frames: session.traffic.frames, startedAt: performance.now() };
  }

  private logSnapshotSent(
    session: GameStreamSession,
    kind: "snapshot" | "scope",
    before: ReturnType<GameStreamHub["measure"]>,
  ): void {
    session.traffic.snapshots += 1;
    this.log.info(
      JSON.stringify({
        bytes: session.traffic.bytes - before.bytes,
        durationMs: Math.round(performance.now() - before.startedAt),
        event: "herald_snapshot_sent",
        frames: session.traffic.frames - before.frames,
        gameId: session.gameId,
        kind,
      }),
    );
  }

  private pruneRing(state: GameStreamState): void {
    const cutoff = Date.now() - RING_MIN_AGE_MS;
    while (state.ring.length > RING_MIN_MESSAGES && state.ring[0]!.recordedAt < cutoff) state.ring.shift();
  }

  private send(session: GameStreamSession, message: HeraldStreamMessage): void {
    this.transmit(session, JSON.stringify(message));
  }

  /** Every frame a subscriber receives passes here, so its traffic counters cover the whole stream. */
  private transmit(session: GameStreamSession, serialized: string): void {
    session.traffic.frames += 1;
    session.traffic.bytes += Buffer.byteLength(serialized);
    session.socket.send(serialized);
  }
}
