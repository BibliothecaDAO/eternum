import type { NativeExecutionOutcome } from "@bibliothecadao/types";
import type { GameSyncModelDefinition } from "./model-manifest";
import { HERALD_GAME_FINALIZED_CLOSE } from "./herald-http-types";
import type {
  GameSyncFact,
  GameSyncHead,
  GameSyncSubscriptionHandlers,
  GameSyncTransaction,
  GameSyncTransport,
  GameSyncWriter,
} from "./game-sync-types";

interface HeraldRow {
  key: string;
  value: Record<string, unknown>;
}

interface HeraldSet extends HeraldRow {
  model: string;
}

interface HeraldDelete {
  key: string;
  model: string;
}

interface HeraldMessageBase {
  epoch: string;
  seq: number;
}

type HeraldMessage =
  | (HeraldMessageBase & {
      type: "hello";
      confirmed_block: number;
      confirmed_timestamp?: number | null;
      preconfirmed_block: number | null;
    })
  | (HeraldMessageBase & { type: "snapshot"; model: string; rows: HeraldRow[] })
  | (HeraldMessageBase & { type: "snapshot_end" })
  | (HeraldMessageBase & { type: "scope"; actor?: string; expedition: boolean; set: HeraldSet[] })
  | (HeraldMessageBase & {
      type: "diff";
      block: number | null;
      preconfirmed: boolean;
      transaction_hash?: string;
      set: HeraldSet[];
      del: HeraldDelete[];
    })
  | (HeraldMessageBase & { type: "overlay_reset"; confirmed_block: number })
  | (HeraldMessageBase & {
      type: "tx";
      hash: string;
      status: string;
      block: number | null;
      revert_reason?: string;
      executions?: NativeExecutionOutcome[];
    })
  | (HeraldMessageBase & { type: "head"; block: number; timestamp: number; preconfirmed?: boolean });

export interface HeraldSocket {
  close(): void;
  onclose: ((event?: { code?: number; reason?: string }) => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onopen: (() => void) | null;
  send(data: string): void;
}

interface Deferred<Value> {
  promise: Promise<Value>;
  reject: (error: Error) => void;
  resolve: (value: Value) => void;
  settled: boolean;
}

export interface HeraldGameSyncTransportOptions {
  modelDefinition: (name: string) => GameSyncModelDefinition;
  reconnectMs?: number;
  socketFactory?: (url: string) => HeraldSocket;
  url: string;
}

const DEFAULT_RECONNECT_MS = 200;
// A stalled browser WebSocket handshake took 31 seconds before retrying during entry profiling.
const HELLO_TIMEOUT_MS = 10_000;

const deferred = <Value>(): Deferred<Value> => {
  let rejectPromise!: (error: Error) => void;
  let resolvePromise!: (value: Value) => void;
  const result: Deferred<Value> = {
    promise: new Promise<Value>((resolve, reject) => {
      rejectPromise = reject;
      resolvePromise = resolve;
    }),
    reject: (error) => {
      if (result.settled) return;
      result.settled = true;
      rejectPromise(error);
    },
    resolve: (value) => {
      if (result.settled) return;
      result.settled = true;
      resolvePromise(value);
    },
    settled: false,
  };
  return result;
};

const toFact = ({ model, key, value }: HeraldSet): GameSyncFact => ({ model, key, value });

const toRemoval = ({ model, key }: HeraldDelete): GameSyncFact => ({ model, key, value: null });

/**
 * Herald's stream, forwarded in order: snapshots, scope replacements and diffs become store facts, event rows become
 * events. The transport keeps no copy of the rows it forwards; the native store is the one place they live.
 */
export class HeraldGameSyncTransport implements GameSyncTransport {
  public readonly transactionStatusChannel = true;
  private readonly reconnectMs: number;
  private readonly socketFactory: (url: string) => HeraldSocket;
  private handlers?: GameSyncSubscriptionHandlers;
  private ready = deferred<void>();
  private socket?: HeraldSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private helloTimer?: ReturnType<typeof setTimeout>;
  private pendingActor?: string | null;
  private resumed = false;
  private epoch = "";
  private seq = 0;
  private attachedThroughBlock = Number.MAX_SAFE_INTEGER;
  private stopped = true;
  private forceFreshSnapshot = true;
  private firstSnapshotEnded = false;
  private snapshotStreaming = false;
  private acceptingSnapshotOverlay = false;
  private snapshotBytesReceived = 0;
  private snapshotModelsReceived = 0;
  private snapshotRowsReceived = 0;

  constructor(private readonly options: HeraldGameSyncTransportOptions) {
    this.reconnectMs = options.reconnectMs ?? DEFAULT_RECONNECT_MS;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as HeraldSocket);
  }

  public selectActor(actor: string | undefined): void {
    const url = new URL(this.options.url);
    const address = actor === undefined ? null : `0x${BigInt(actor).toString(16)}`;
    if (url.searchParams.get("actor") === address) return;
    if (address === null) url.searchParams.delete("actor");
    else url.searchParams.set("actor", address);
    this.options.url = url.toString();
    this.pendingActor = address;
    this.sendActorSelection();
  }

  private sendActorSelection(): void {
    if (!this.resumed || !this.socket || this.pendingActor === undefined) return;
    this.socket.send(JSON.stringify({ type: "select_actor", actor: this.pendingActor }));
    this.pendingActor = undefined;
  }

  public async subscribe(handlers: GameSyncSubscriptionHandlers): Promise<GameSyncWriter> {
    this.stop();
    this.resetSession(handlers);
    this.connect();
    await this.ready.promise;
    return { cancel: () => this.stop() };
  }

  private resetSession(handlers: GameSyncSubscriptionHandlers): void {
    this.handlers = handlers;
    this.ready = deferred<void>();
    this.epoch = "";
    this.seq = 0;
    this.forceFreshSnapshot = true;
    this.firstSnapshotEnded = false;
    this.snapshotStreaming = false;
    this.acceptingSnapshotOverlay = false;
    this.stopped = false;
  }

  private connect(): void {
    if (this.stopped) return;
    this.resumed = false;
    const socket = this.socketFactory(this.options.url);
    this.socket = socket;
    this.helloTimer = setTimeout(() => {
      if (this.socket !== socket) return;
      console.warn(`[Herald] No hello within ${HELLO_TIMEOUT_MS}ms; reconnecting`);
      this.reconnectSocket(socket);
    }, HELLO_TIMEOUT_MS);
    socket.onmessage = ({ data }) => {
      if (this.socket === socket) this.acceptMessage(data);
    };
    socket.onerror = () => this.reconnectSocket(socket);
    socket.onclose = (event) =>
      event?.code === HERALD_GAME_FINALIZED_CLOSE ? this.endFinalized(socket) : this.reconnectSocket(socket);
  }

  /** Herald will never serve a finalized game again, so the stream ends instead of reconnecting. */
  private endFinalized(socket: HeraldSocket): void {
    if (this.socket !== socket) return;
    this.stop();
    const failure = new Error(`The game at ${this.options.url} is finalized; its review holds the final state`);
    console.warn(`[Herald] ${failure.message}; not reconnecting`);
    if (!this.ready.settled) this.ready.reject(failure);
    else if (!this.firstSnapshotEnded) this.handlers?.onStartFailure(failure);
  }

  private reconnectSocket(socket: HeraldSocket): void {
    if (this.socket !== socket) return;
    this.closeSocket();
    // A snapshot cut short can only be completed by a fresh one.
    if (this.snapshotStreaming) this.forceFreshSnapshot = true;
    this.snapshotStreaming = false;
    this.scheduleReconnect();
  }

  private clearHelloTimer(): void {
    if (this.helloTimer !== undefined) clearTimeout(this.helloTimer);
    this.helloTimer = undefined;
  }

  private closeSocket(): void {
    this.clearHelloTimer();
    const socket = this.socket;
    this.socket = undefined;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
    socket.close();
  }

  private acceptMessage(data: unknown): void {
    try {
      const serialized = String(data);
      const message = this.parseMessage(serialized);
      if (message.type === "hello") this.acceptHello(message);
      else if (message.type === "scope") this.acceptScope(message);
      else if (message.type === "snapshot") this.acceptSnapshotModel(message, serialized.length);
      else if (message.type === "snapshot_end") this.acceptSnapshotEnd(message);
      else this.acceptSequencedMessage(message);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      console.error(`[GameSync] Herald message rejected: ${failure.message}`);
      if (!this.ready.settled) this.ready.reject(failure);
      else if (!this.firstSnapshotEnded) this.handlers?.onStartFailure(failure);
      this.forceFreshSnapshot = true;
      if (this.socket) this.reconnectSocket(this.socket);
    }
  }

  private acceptHello(message: Extract<HeraldMessage, { type: "hello" }>): void {
    this.attachedThroughBlock = message.confirmed_block;
    // Chain time before any row: a snapshot's first reader (a Frontier realm's daily site) must not guess the clock.
    if (typeof message.confirmed_timestamp === "number" && message.confirmed_timestamp > 0) {
      this.handlers?.onHead({
        block: message.confirmed_block,
        preconfirmed: false,
        timestamp: message.confirmed_timestamp,
      });
    }
    this.clearHelloTimer();
    this.socket?.send(
      JSON.stringify({
        type: "resume",
        epoch: this.forceFreshSnapshot ? "" : this.epoch,
        seq: this.forceFreshSnapshot ? 0 : this.seq,
      }),
    );
    this.resumed = true;
    this.sendActorSelection();
    this.ready.resolve();
  }

  private acceptScope(message: Extract<HeraldMessage, { type: "scope" }>): void {
    this.handlers?.onScope(message.set.map(toFact), message.expedition);
    this.epoch = message.epoch;
    this.seq = message.seq;
    this.acceptingSnapshotOverlay = true;
  }

  private acceptSnapshotModel(message: Extract<HeraldMessage, { type: "snapshot" }>, bytesReceived: number): void {
    if (!this.snapshotStreaming) {
      this.snapshotStreaming = true;
      this.snapshotBytesReceived = this.snapshotModelsReceived = this.snapshotRowsReceived = 0;
      this.handlers?.onSnapshotStart();
    }
    this.snapshotBytesReceived += bytesReceived;
    this.snapshotModelsReceived += 1;
    this.snapshotRowsReceived += message.rows.length;
    this.handlers?.onSnapshotModel(
      message.model,
      message.rows.map((row) => toFact({ ...row, model: message.model })),
      {
        bytesReceived: this.snapshotBytesReceived,
        model: message.model,
        modelsReceived: this.snapshotModelsReceived,
        rowsReceived: this.snapshotRowsReceived,
      },
    );
  }

  private acceptSnapshotEnd(message: Extract<HeraldMessage, { type: "snapshot_end" }>): void {
    if (!this.snapshotStreaming) this.handlers?.onSnapshotStart();
    this.snapshotStreaming = false;
    this.firstSnapshotEnded = true;
    this.handlers?.onSnapshotEnd();
    this.epoch = message.epoch;
    this.seq = message.seq;
    this.forceFreshSnapshot = false;
    this.acceptingSnapshotOverlay = true;
  }

  private acceptSequencedMessage(
    message: Exclude<HeraldMessage, { type: "hello" | "snapshot" | "snapshot_end" | "scope" }>,
  ): void {
    if (this.acceptSnapshotOverlay(message)) return;
    this.acceptingSnapshotOverlay = false;
    if (message.epoch !== this.epoch || message.seq !== this.seq + 1) {
      throw new Error(
        `Herald stream gap: expected ${this.epoch || "<snapshot>"}:${this.seq + 1}, received ${message.epoch}:${message.seq}`,
      );
    }

    if (message.type === "diff") this.acceptDiff(message);
    else if (message.type === "tx") this.acceptTransaction(message);
    else if (message.type === "head") this.acceptHead(message);
    this.seq = message.seq;
  }

  private acceptSnapshotOverlay(
    message: Exclude<HeraldMessage, { type: "hello" | "snapshot" | "snapshot_end" | "scope" }>,
  ): boolean {
    if (!this.acceptingSnapshotOverlay || message.type !== "diff") return false;
    if (!message.preconfirmed || message.epoch !== this.epoch || message.seq !== this.seq) return false;
    this.acceptDiff(message);
    return true;
  }

  /** Facts and events are split before anything is delivered, so a rejected diff delivers nothing. */
  private acceptDiff(message: Extract<HeraldMessage, { type: "diff" }>): void {
    const isEvent = (model: string) => this.options.modelDefinition(model).deletion === "event-ephemeral";
    const events = message.set.filter((row) => isEvent(row.model));
    const facts = [
      ...message.set.filter((row) => !isEvent(row.model)).map(toFact),
      ...message.del.filter((row) => !isEvent(row.model)).map(toRemoval),
    ];
    if (facts.length > 0) {
      this.handlers?.onFacts({
        facts,
        preconfirmed: message.preconfirmed,
        ...(message.transaction_hash ? { transactionHash: message.transaction_hash } : {}),
      });
    }
    for (const event of events) this.deliverEvent(event, message);
  }

  private deliverEvent(event: HeraldSet, confirmation: { block: number | null; preconfirmed: boolean }): void {
    try {
      this.handlers?.onEvent(
        { model: event.model, key: event.key, value: event.value },
        {
          block: confirmation.block,
          preconfirmed: confirmation.preconfirmed,
          confirmedAfterAttach:
            !confirmation.preconfirmed && confirmation.block !== null && confirmation.block > this.attachedThroughBlock,
        },
      );
    } catch (error) {
      // Ephemeral delivery cannot undo persistent rows or interrupt following transaction status.
      console.error(`[GameSync] event delivery failed for ${event.model}: ${String(error)}`);
    }
  }

  private acceptTransaction(message: Extract<HeraldMessage, { type: "tx" }>): void {
    const transaction: GameSyncTransaction = {
      block: message.block,
      hash: message.hash,
      status: message.status,
      ...(message.executions !== undefined ? { executions: message.executions } : {}),
      ...(message.revert_reason ? { revertReason: message.revert_reason } : {}),
    };
    this.handlers?.onTransaction(transaction);
  }

  private acceptHead(message: Extract<HeraldMessage, { type: "head" }>): void {
    const head: GameSyncHead = {
      block: message.block,
      preconfirmed: message.preconfirmed === true,
      timestamp: message.timestamp,
    };
    this.handlers?.onHead(head);
  }

  private parseMessage(data: string): HeraldMessage {
    const parsed = JSON.parse(data) as Partial<HeraldMessage>;
    if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
      throw new Error("Herald sent an invalid stream message");
    }
    if (typeof parsed.epoch !== "string" || !Number.isSafeInteger(parsed.seq)) {
      throw new Error(`Herald ${parsed.type} message has no epoch/sequence`);
    }
    return parsed as HeraldMessage;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect();
    }, this.reconnectMs);
  }

  /** Stops reconnecting and fails a subscribe or first snapshot still waiting on the socket. */
  public dispose(): void {
    const wasRunning = !this.stopped;
    this.stop();
    if (!wasRunning) return;
    const failure = new Error("Herald transport was disposed before its subscription became active");
    if (!this.ready.settled) this.ready.reject(failure);
    else if (!this.firstSnapshotEnded) this.handlers?.onStartFailure(failure);
  }

  private stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.closeSocket();
  }
}
