import { isScopedGameSyncModel } from "@bibliothecadao/eternum/game-sync-models";
import { randomUUID } from "node:crypto";

import type { GameSnapshot } from "./types";
import type { HeraldStreamMessage, ResumeRequest } from "./stream-protocol";

const RING_MIN_MESSAGES = 10_000;
const RING_MIN_AGE_MS = 10 * 60 * 1_000;

export interface StreamSocket {
  send(data: string): unknown;
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
  ring: RingEntry[];
  seq: number;
  subscribers: Set<GameStreamSession>;
  /** When the last subscriber left. A reconnect within a ring window still resumes; after it the state is dropped. */
  idleSince?: number;
}

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
  private readonly games = new Map<string, GameStreamState>();

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
    const state = this.games.get(this.streamKey(session.gameId, session.actor))!;
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
    const state = this.games.get(this.streamKey(session.gameId, session.actor));
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

  public publishDiff(
    gameId: string,
    input: Omit<Extract<HeraldStreamMessage, { type: "diff" }>, "epoch" | "seq" | "type">,
  ): void {
    this.publish(gameId, { ...input, type: "diff" });
  }

  public publishOverlayReset(gameId: string, confirmedBlock: number): void {
    this.publish(gameId, { confirmed_block: confirmedBlock, type: "overlay_reset" });
  }

  public publishTransaction(
    gameId: string,
    input: Omit<Extract<HeraldStreamMessage, { type: "tx" }>, "epoch" | "seq" | "type">,
    actors: readonly string[],
  ): void {
    this.publish(gameId, { ...input, type: "tx" }, actors);
  }

  /** A confirmed head, or with `preconfirmed` the sequencer clock read off the pre-confirmed block. */
  public publishHead(gameId: string, block: number, timestamp: number, preconfirmed = false): void {
    this.publish(gameId, { block, preconfirmed, timestamp, type: "head" });
  }

  private publish(gameId: string, body: PublishedBody, actors?: readonly string[]): void {
    for (const [key, state] of this.games) {
      if (isAbandoned(state)) {
        this.games.delete(key);
        continue;
      }
      if (state.gameId !== gameId) continue;
      if (actors && (state.actor === undefined || !actors.some((actor) => BigInt(actor) === BigInt(state.actor!))))
        continue;
      for (const projected of state.project ? state.project(body) : [body]) {
        const message = { ...projected, epoch: this.streamEpoch(state.gameId, state.actor), seq: ++state.seq };
        const serialized = JSON.stringify(message);
        state.ring.push({ recordedAt: Date.now(), seq: message.seq, serialized });
        this.pruneRing(state);
        for (const subscriber of state.subscribers) if (subscriber.active) this.transmit(subscriber, serialized);
      }
    }
  }

  private streamEpoch(gameId: string, actor?: string): string {
    return `${this.epoch}:${gameId}:${actor === undefined ? "" : BigInt(actor).toString()}`;
  }

  private streamKey(gameId: string, actor?: string): string {
    return `${gameId}:${actor === undefined ? "" : BigInt(actor).toString()}`;
  }

  private game(input: AttachInput): GameStreamState {
    const key = this.streamKey(input.gameId, input.actor);
    let state = this.games.get(key);
    if (!state) {
      state = {
        actor: input.actor,
        gameId: input.gameId,
        project: input.project,
        ring: [],
        seq: 0,
        subscribers: new Set(),
      };
      this.games.set(key, state);
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
