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
  ring: RingEntry[];
  seq: number;
  subscribers: Set<GameStreamSession>;
}

export interface SnapshotOverlayDiff {
  block: number | null;
  del: Extract<HeraldStreamMessage, { type: "diff" }>["del"];
  set: Extract<HeraldStreamMessage, { type: "diff" }>["set"];
  transaction_hash?: string;
}

type PublishedMessage = Extract<HeraldStreamMessage, { type: "diff" | "overlay_reset" | "tx" | "head" }>;
type PublishBody<Message> = Message extends unknown ? Omit<Message, "epoch" | "seq"> : never;

export interface GameStreamSession {
  active: boolean;
  boundary: number;
  gameId: string;
  overlay?: SnapshotOverlayDiff[];
  snapshot?: GameSnapshot;
  socket: StreamSocket;
}

interface AttachInput {
  confirmedBlock: number;
  gameId: string;
  preconfirmedBlock: number | null;
  overlay: () => SnapshotOverlayDiff[];
  snapshot: () => GameSnapshot;
  socket: StreamSocket;
}

export class GameStreamHub {
  public readonly epoch: string;
  private readonly games = new Map<string, GameStreamState>();

  constructor(epoch: string = randomUUID()) {
    this.epoch = epoch;
  }

  public attach(input: AttachInput): GameStreamSession {
    const state = this.game(input.gameId);
    const session: GameStreamSession = {
      active: false,
      boundary: state.seq,
      gameId: input.gameId,
      socket: input.socket,
    };
    state.subscribers.add(session);
    try {
      session.snapshot = input.snapshot();
      session.overlay = input.overlay();
    } catch (error) {
      state.subscribers.delete(session);
      throw error;
    }
    this.send(session.socket, {
      confirmed_block: input.confirmedBlock,
      epoch: this.epoch,
      preconfirmed_block: input.preconfirmedBlock,
      seq: session.boundary,
      type: "hello",
    });
    return session;
  }

  public resume(session: GameStreamSession, request: ResumeRequest): void {
    if (session.active) throw new Error("Stream session already resumed");
    const state = this.game(session.gameId);
    const canResume = this.canResume(state, request);
    const resumeFrom = canResume ? request.seq : session.boundary;

    if (!canResume) this.sendSnapshot(session);

    session.active = true;
    for (const entry of state.ring) {
      if (entry.seq > resumeFrom) session.socket.send(entry.serialized);
    }
  }

  public detach(session: GameStreamSession): void {
    this.games.get(session.gameId)?.subscribers.delete(session);
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
  ): void {
    this.publish(gameId, { ...input, type: "tx" });
  }

  public publishHead(gameId: string, block: number, timestamp: number): void {
    this.publish(gameId, { block, timestamp, type: "head" });
  }

  private publish(gameId: string, body: PublishBody<PublishedMessage>): void {
    const state = this.games.get(gameId);
    if (!state) return;
    const message = { ...body, epoch: this.epoch, seq: ++state.seq } as HeraldStreamMessage;
    // Serialized once: every subscriber receives the same string, and resume replays it from the ring.
    const serialized = JSON.stringify(message);
    state.ring.push({ recordedAt: Date.now(), seq: message.seq, serialized });
    this.pruneRing(state);
    for (const subscriber of state.subscribers) {
      if (subscriber.active) subscriber.socket.send(serialized);
    }
  }

  private game(gameId: string): GameStreamState {
    let state = this.games.get(gameId);
    if (!state) {
      state = { ring: [], seq: 0, subscribers: new Set() };
      this.games.set(gameId, state);
    }
    return state;
  }

  private canResume(state: GameStreamState, request: ResumeRequest): boolean {
    if (request.epoch !== this.epoch || !Number.isSafeInteger(request.seq) || request.seq < 0) return false;
    if (request.seq > state.seq) return false;
    const oldest = state.ring[0]?.seq ?? state.seq + 1;
    return request.seq >= oldest - 1;
  }

  private sendSnapshot(session: GameStreamSession): void {
    if (!session.snapshot) throw new Error("Stream session has no snapshot boundary");
    for (const model of session.snapshot.models) {
      this.send(session.socket, {
        epoch: this.epoch,
        model: model.model,
        rows: model.rows,
        seq: session.boundary,
        type: "snapshot",
      });
    }
    this.send(session.socket, { epoch: this.epoch, seq: session.boundary, type: "snapshot_end" });
    for (const overlay of session.overlay ?? []) {
      this.send(session.socket, {
        ...overlay,
        epoch: this.epoch,
        preconfirmed: true,
        seq: session.boundary,
        type: "diff",
      });
    }
  }

  private pruneRing(state: GameStreamState): void {
    const cutoff = Date.now() - RING_MIN_AGE_MS;
    while (state.ring.length > RING_MIN_MESSAGES && state.ring[0]!.recordedAt < cutoff) state.ring.shift();
  }

  private send(socket: StreamSocket, message: HeraldStreamMessage): void {
    socket.send(JSON.stringify(message));
  }
}
