import { isScopedGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { randomUUID } from "node:crypto";
import { HERALD_GAME_FINALIZED_CLOSE } from "@bibliothecadao/eternum/game-sync";
import { GameFinalizedError } from "./world-fold";

import type { FoldSet, GameSnapshot } from "./types";
import type { HeraldStreamMessage, ResumeRequest } from "./stream-protocol";

// One budget across every game and actor, including disconnected resumable states.
const REPLAY_BYTES = 256 * 1024 * 1024;
const REPLAY_MAX_AGE_MS = 10 * 60 * 1_000;

export interface StreamSocket {
  send(data: string): unknown;
  close?(code?: number, reason?: string): void;
}

interface RingEntry {
  state: GameStreamState;
  previous?: RingEntry;
  next?: RingEntry;
  bytes: number;
  recordedAt: number;
  seq: number;
  serialized: string;
}

interface GameStreamState {
  actor?: string;
  visit?: string;
  gameId: string;
  project?: (body: PublishedBody) => PublishedBody[];
  /** The keys a published row reaches this state by; without it, every row does. */
  interest?: () => ReadonlySet<string>;
  indexed?: ReadonlySet<string>;
  ring: Map<number, RingEntry>;
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
  visit?: string;
  active: boolean;
  boundary: number;
  gameId: string;
  overlay?: SnapshotOverlayDiff[];
  snapshot?: GameSnapshot;
  capture?: () => { snapshot: GameSnapshot; overlay: SnapshotOverlayDiff[] };
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
  visit?: string;
  expedition?: boolean;
  project?: (body: PublishedBody) => PublishedBody[];
  interest?: () => ReadonlySet<string>;
  confirmedBlock: number;
  /** The chain time of the last confirmed head, so a client knows the clock before it reads any row. */
  confirmedTimestamp?: number | null;
  gameId: string;
  preconfirmedBlock: number | null;
  overlay: () => SnapshotOverlayDiff[];
  snapshot: () => GameSnapshot;
  socket: StreamSocket;
}

/** No subscriber has been back for a ring window: nobody can resume from this ring any more. */
const isAbandoned = (state: GameStreamState): boolean =>
  state.idleSince !== undefined && Date.now() - state.idleSince > REPLAY_MAX_AGE_MS;

export class GameStreamHub {
  public readonly epoch: string;
  private readonly games = new Map<string, GameStreams>();
  private oldestReplay?: RingEntry;
  private newestReplay?: RingEntry;
  private replayEntries = 0;
  private replayBytes = 0;

  constructor(
    epoch: string = randomUUID(),
    private readonly log: Pick<Console, "info"> = console,
    private readonly replayByteLimit = REPLAY_BYTES,
  ) {
    this.epoch = epoch;
  }

  public attach(input: AttachInput): GameStreamSession {
    const existed = this.stateOf(input.gameId, input.actor, input.visit) !== undefined;
    const state = this.game(input);
    const session: GameStreamSession = {
      actor: input.actor,
      visit: input.visit,
      active: false,
      boundary: state.seq,
      gameId: input.gameId,
      socket: input.socket,
      traffic: { attachedAt: Date.now(), bytes: 0, frames: 0, snapshots: 0 },
    };
    state.subscribers.add(session);
    state.idleSince = undefined;
    try {
      session.capture = () => ({ snapshot: input.snapshot(), overlay: input.overlay() });
      Object.assign(session, session.capture());
    } catch (error) {
      this.leave(session);
      // A stream state this attach created serves nobody once the attach fails, so a refusal leaves nothing behind.
      if (!existed && state.subscribers.size === 0) this.forget(state);
      throw error;
    }
    this.send(session, {
      confirmed_block: input.confirmedBlock,
      confirmed_timestamp: input.confirmedTimestamp ?? null,
      epoch: this.streamEpoch(input.gameId, input.actor, input.visit),
      preconfirmed_block: input.preconfirmedBlock,
      seq: session.boundary,
      type: "hello",
    });
    return session;
  }

  public resume(session: GameStreamSession, request: ResumeRequest): void {
    if (session.active) throw new Error("Stream session already resumed");
    const state = this.stateOf(session.gameId, session.actor, session.visit)!;
    this.pruneReplay();
    const canResume = this.canResume(state, request);
    if (!canResume && !this.holdsAfter(state, session.boundary)) {
      session.boundary = state.seq;
      Object.assign(session, session.capture!());
      if (!this.holdsAfter(state, session.boundary)) {
        session.socket.close?.(1013, "snapshot_replay_expired");
        this.leave(session);
        return;
      }
    }
    const resumeFrom = canResume ? request.seq : session.boundary;

    if (!canResume) this.sendSnapshot(session);

    session.active = true;
    // The boundary is only needed until the session is live; keeping it would hold a snapshot per subscriber.
    session.snapshot = undefined;
    session.overlay = undefined;
    session.capture = undefined;
    for (const entry of state.ring.values()) {
      if (entry.seq > resumeFrom) this.transmit(session, entry.serialized);
    }
  }

  /** The games with a stream state; a game leaves once its last state is forgotten. */
  public streamedGames(): string[] {
    return [...this.games.keys()];
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
    const state = this.stateOf(session.gameId, session.actor, session.visit);
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
    session.visit = input.visit;
    session.boundary = state.seq;
    state.subscribers.add(session);
    state.idleSince = undefined;
    const sent = this.measure(session);
    this.send(session, {
      type: "scope",
      epoch: this.streamEpoch(input.gameId, input.actor, input.visit),
      seq: state.seq,
      actor: input.actor,
      visit: input.visit,
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
        epoch: this.streamEpoch(input.gameId, input.actor, input.visit),
        seq: state.seq,
      });
    this.logSnapshotSent(session, "scope", sent);
  }

  /** Deletes route with their pre-delete rows; routing metadata never enters the wire message. */
  public publishDiff(
    gameId: string,
    input: Omit<Extract<HeraldStreamMessage, { type: "diff" }>, "epoch" | "seq" | "type">,
    rowKeys?: RowStreamKeys,
    deletedRows: readonly FoldSet[] = [],
  ): void {
    const game = this.games.get(gameId);
    if (!game) return;
    if (rowKeys && input.del.length !== deletedRows.length)
      throw new Error("Deleted rows require pre-delete routing metadata");
    const named = rowKeys ? this.named(game, [...input.set, ...deletedRows], rowKeys) : undefined;
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
    const owners = new Set(actors.map((actor) => BigInt(actor).toString()));
    const states = [...(this.games.get(gameId)?.states.values() ?? [])].filter(
      (state) => state.actor !== undefined && owners.has(BigInt(state.actor).toString()),
    );
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
        this.end(state, error);
        continue;
      }
      for (const projected of projections) {
        const message = {
          ...projected,
          epoch: this.streamEpoch(state.gameId, state.actor, state.visit),
          seq: ++state.seq,
        };
        const serialized = JSON.stringify(message);
        this.retain(state, message.seq, serialized);
        for (const subscriber of state.subscribers) if (subscriber.active) this.transmit(subscriber, serialized);
      }
      // Projecting can move a scope, and with it the keys that reach this state.
      this.index(game, state);
    }
  }

  /** Drops a stream state and closes its subscribers with the reason, as a failed attach is closed. */
  private end(state: GameStreamState, error: unknown): void {
    const finalized = error instanceof GameFinalizedError;
    const reason = finalized
      ? "game_finalized"
      : (error instanceof Error ? error.message : String(error)).slice(0, 120);
    this.log.info(
      JSON.stringify({ event: "herald_stream_ended", gameId: state.gameId, actor: state.actor ?? null, reason }),
    );
    this.forget(state);
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
    for (const state of game.states.values()) if (isAbandoned(state)) this.forget(state);
    return [...game.states.values()];
  }

  /** Drops a stream state, its keys, and its game's entry once the game has no stream left. */
  private forget(state: GameStreamState): void {
    const game = this.games.get(state.gameId);
    if (!game) return;
    for (const entry of state.ring.values()) this.evict(entry);
    game.states.delete(this.streamKey(state.gameId, state.actor, state.visit));
    game.unindexed.delete(state);
    this.unindex(game, state);
    if (game.states.size === 0) this.games.delete(state.gameId);
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

  private stateOf(gameId: string, actor?: string, visit?: string): GameStreamState | undefined {
    return this.games.get(gameId)?.states.get(this.streamKey(gameId, actor, visit));
  }

  private streamEpoch(gameId: string, actor?: string, visit?: string): string {
    return `${this.epoch}:${this.streamKey(gameId, actor, visit)}`;
  }

  private streamKey(gameId: string, actor?: string, visit?: string): string {
    const acting = `${gameId}:${actor === undefined ? "" : BigInt(actor).toString()}`;
    return visit === undefined ? acting : `${acting}:${BigInt(visit).toString()}`;
  }

  private game(input: AttachInput): GameStreamState {
    const game = this.games.get(input.gameId) ?? { states: new Map(), byKey: new Map(), unindexed: new Set() };
    this.games.set(input.gameId, game);
    const key = this.streamKey(input.gameId, input.actor, input.visit);
    let state = game.states.get(key);
    if (!state) {
      state = {
        actor: input.actor,
        visit: input.visit,
        gameId: input.gameId,
        project: input.project,
        interest: input.interest,
        ring: new Map(),
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
      request.epoch !== this.streamEpoch(state.gameId, state.actor, state.visit) ||
      !Number.isSafeInteger(request.seq) ||
      request.seq < 0
    )
      return false;
    if (request.seq > state.seq) return false;
    return this.holdsAfter(state, request.seq);
  }

  private holdsAfter(state: GameStreamState, seq: number): boolean {
    const oldest = state.ring.keys().next().value ?? state.seq + 1;
    return seq >= oldest - 1;
  }

  private sendSnapshot(session: GameStreamSession): void {
    if (!session.snapshot) throw new Error("Stream session has no snapshot boundary");
    const sent = this.measure(session);
    for (const model of session.snapshot.models) {
      this.send(session, {
        epoch: this.streamEpoch(session.gameId, session.actor, session.visit),
        model: model.model,
        rows: model.rows,
        seq: session.boundary,
        type: "snapshot",
      });
    }
    this.send(session, {
      epoch: this.streamEpoch(session.gameId, session.actor, session.visit),
      seq: session.boundary,
      type: "snapshot_end",
    });
    for (const overlay of session.overlay ?? []) {
      this.send(session, {
        ...overlay,
        epoch: this.streamEpoch(session.gameId, session.actor, session.visit),
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

  /** Charged retained bytes and entries for capacity measurements, independent of subscriber count. */
  public replayUsage(): { bytes: number; entries: number; limit: number; oldestAgeSeconds: number | null } {
    this.pruneReplay();
    return {
      bytes: this.replayBytes,
      entries: this.replayEntries,
      limit: this.replayByteLimit,
      oldestAgeSeconds: this.oldestReplay ? (Date.now() - this.oldestReplay.recordedAt) / 1000 : null,
    };
  }

  private retain(state: GameStreamState, seq: number, serialized: string): void {
    // Charge UTF-16 storage even for one-byte strings, plus entry/index overhead. This is a retention budget,
    // not a measurement of the runtime's heap layout; small messages still pay for their container entries.
    const entry: RingEntry = {
      state,
      previous: this.newestReplay,
      bytes: serialized.length * 2 + 256,
      recordedAt: Date.now(),
      seq,
      serialized,
    };
    state.ring.set(seq, entry);
    if (this.newestReplay) this.newestReplay.next = entry;
    else this.oldestReplay = entry;
    this.newestReplay = entry;
    this.replayEntries++;
    this.replayBytes += entry.bytes;
    this.pruneReplay();
  }

  private pruneReplay(): void {
    const cutoff = Date.now() - REPLAY_MAX_AGE_MS;
    while (this.oldestReplay) {
      const entry = this.oldestReplay;
      if (this.replayBytes <= this.replayByteLimit && entry.recordedAt >= cutoff) break;
      this.evict(entry);
    }
  }

  private evict(entry: RingEntry): void {
    entry.state.ring.delete(entry.seq);
    if (entry.previous) entry.previous.next = entry.next;
    else this.oldestReplay = entry.next;
    if (entry.next) entry.next.previous = entry.previous;
    else this.newestReplay = entry.previous;
    this.replayEntries--;
    this.replayBytes -= entry.bytes;
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
