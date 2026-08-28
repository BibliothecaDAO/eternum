import { getGameSyncModel } from "./model-manifest";
import type {
  GameSyncEntity,
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
      preconfirmed_block: number | null;
    })
  | (HeraldMessageBase & { type: "snapshot"; model: string; rows: HeraldRow[] })
  | (HeraldMessageBase & { type: "snapshot_end" })
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
    })
  | (HeraldMessageBase & { type: "head"; block: number; timestamp: number });

export interface HeraldSocket {
  close(): void;
  onclose: (() => void) | null;
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

type StoredRow = HeraldSet;

export interface HeraldGameSyncTransportOptions {
  reconnectMs?: number;
  socketFactory?: (url: string) => HeraldSocket;
  url: string;
}

const DEFAULT_RECONNECT_MS = 200;

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

const rowIdentity = (model: string, key: string): string => `${model}:${key}`;
const utf8Encoder = new TextEncoder();

const toEntity = ({ key, model, value }: StoredRow): GameSyncEntity => ({
  hashed_keys: key,
  models: { [model]: value },
});

const toRemoval = ({ key, model }: HeraldDelete): GameSyncEntity => ({
  hashed_keys: key,
  models: { [model]: {} },
});

export class HeraldGameSyncTransport implements GameSyncTransport {
  public readonly transactionStatusChannel = true;
  private readonly reconnectMs: number;
  private readonly socketFactory: (url: string) => HeraldSocket;
  private readonly confirmedRows = new Map<string, StoredRow>();
  private readonly currentRows = new Map<string, StoredRow>();
  private readonly pendingRows = new Set<string>();
  private handlers?: GameSyncSubscriptionHandlers;
  private initialSnapshot = deferred<{ items: GameSyncEntity[] }>();
  private ready = deferred<void>();
  private snapshotRows?: Map<string, StoredRow>;
  private socket?: HeraldSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private epoch = "";
  private seq = 0;
  private stopped = true;
  private forceFreshSnapshot = true;
  private acceptingSnapshotOverlay = false;
  private snapshotBytesReceived = 0;
  private snapshotModelsReceived = 0;
  private snapshotRowsReceived = 0;

  constructor(private readonly options: HeraldGameSyncTransportOptions) {
    this.reconnectMs = options.reconnectMs ?? DEFAULT_RECONNECT_MS;
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as HeraldSocket);
  }

  public async subscribe(handlers: GameSyncSubscriptionHandlers): Promise<GameSyncWriter> {
    this.stop();
    this.resetSession(handlers);
    this.connect();
    await this.ready.promise;
    return { cancel: () => this.stop() };
  }

  public async fetchSnapshotPage(cursor?: string): Promise<{ items: GameSyncEntity[] }> {
    if (cursor) throw new Error(`Herald snapshots have one page; received cursor ${cursor}`);
    return this.initialSnapshot.promise;
  }

  private resetSession(handlers: GameSyncSubscriptionHandlers): void {
    this.handlers = handlers;
    this.ready = deferred<void>();
    this.initialSnapshot = deferred<{ items: GameSyncEntity[] }>();
    this.confirmedRows.clear();
    this.currentRows.clear();
    this.pendingRows.clear();
    this.snapshotRows = undefined;
    this.epoch = "";
    this.seq = 0;
    this.forceFreshSnapshot = true;
    this.acceptingSnapshotOverlay = false;
    this.snapshotBytesReceived = 0;
    this.snapshotModelsReceived = 0;
    this.snapshotRowsReceived = 0;
    this.stopped = false;
  }

  private connect(): void {
    if (this.stopped) return;
    const socket = this.socketFactory(this.options.url);
    this.socket = socket;
    socket.onopen = () => undefined;
    socket.onmessage = ({ data }) => this.acceptMessage(data);
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = undefined;
      this.snapshotRows = undefined;
      this.scheduleReconnect();
    };
  }

  private acceptMessage(data: unknown): void {
    try {
      const serialized = String(data);
      const message = this.parseMessage(serialized);
      if (message.type === "hello") {
        this.acceptHello(message);
        return;
      }
      if (message.type === "snapshot") {
        this.acceptSnapshotChunk(message, utf8Encoder.encode(serialized).byteLength);
        return;
      }
      if (message.type === "snapshot_end") {
        this.acceptSnapshotEnd(message);
        return;
      }
      this.acceptSequencedMessage(message);
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error));
      if (!this.ready.settled) this.ready.reject(failure);
      if (!this.initialSnapshot.settled) this.initialSnapshot.reject(failure);
      this.forceFreshSnapshot = true;
      this.socket?.close();
    }
  }

  private acceptHello(message: Extract<HeraldMessage, { type: "hello" }>): void {
    this.socket?.send(
      JSON.stringify({
        type: "resume",
        epoch: this.forceFreshSnapshot ? "" : this.epoch,
        seq: this.forceFreshSnapshot ? 0 : this.seq,
      }),
    );
    this.ready.resolve();
  }

  private acceptSnapshotChunk(message: Extract<HeraldMessage, { type: "snapshot" }>, bytesReceived: number): void {
    this.snapshotRows ??= new Map();
    message.rows.forEach((row) => {
      const stored = { ...row, model: message.model };
      this.snapshotRows?.set(rowIdentity(stored.model, stored.key), stored);
    });
    this.snapshotBytesReceived += bytesReceived;
    this.snapshotModelsReceived += 1;
    this.snapshotRowsReceived += message.rows.length;
    this.handlers?.onSnapshotChunk?.({
      bytesReceived: this.snapshotBytesReceived,
      model: message.model,
      modelsReceived: this.snapshotModelsReceived,
      rowsReceived: this.snapshotRowsReceived,
    });
  }

  private acceptSnapshotEnd(message: Extract<HeraldMessage, { type: "snapshot_end" }>): void {
    const rows = this.snapshotRows ?? new Map<string, StoredRow>();
    const firstSnapshot = !this.initialSnapshot.settled;
    if (firstSnapshot) {
      this.replaceState(rows);
      this.initialSnapshot.resolve({ items: [...rows.values()].map(toEntity) });
    } else {
      this.reconcileSnapshot(rows);
    }
    this.snapshotRows = undefined;
    this.epoch = message.epoch;
    this.seq = message.seq;
    this.forceFreshSnapshot = false;
    this.acceptingSnapshotOverlay = true;
  }

  private acceptSequencedMessage(
    message: Exclude<HeraldMessage, { type: "hello" | "snapshot" | "snapshot_end" }>,
  ): void {
    if (this.acceptSnapshotOverlay(message)) return;
    this.acceptingSnapshotOverlay = false;
    if (message.epoch !== this.epoch || message.seq !== this.seq + 1) {
      throw new Error(
        `Herald stream gap: expected ${this.epoch || "<snapshot>"}:${this.seq + 1}, received ${message.epoch}:${message.seq}`,
      );
    }

    if (message.type === "diff") this.acceptDiff(message);
    else if (message.type === "overlay_reset") this.resetOverlay();
    else if (message.type === "tx") this.acceptTransaction(message);
    else this.acceptHead(message);
    this.seq = message.seq;
  }

  private acceptSnapshotOverlay(
    message: Exclude<HeraldMessage, { type: "hello" | "snapshot" | "snapshot_end" }>,
  ): boolean {
    if (!this.acceptingSnapshotOverlay || message.type !== "diff") return false;
    if (!message.preconfirmed || message.epoch !== this.epoch || message.seq !== this.seq) return false;
    this.acceptDiff(message);
    return true;
  }

  private acceptDiff(message: Extract<HeraldMessage, { type: "diff" }>): void {
    const entities = [
      ...message.set.flatMap((change) => this.acceptSet(change, message.preconfirmed)),
      ...message.del.flatMap((change) => this.acceptDelete(change, message.preconfirmed)),
    ];
    if (entities.length === 0) return;
    if (this.handlers?.onEntityBatch) {
      this.handlers.onEntityBatch({
        entities,
        preconfirmed: message.preconfirmed,
        ...(message.transaction_hash ? { transactionHash: message.transaction_hash } : {}),
      });
      return;
    }
    entities.forEach((entity) => this.handlers?.onEntity(entity));
  }

  private acceptSet(change: HeraldSet, preconfirmed: boolean): GameSyncEntity[] {
    if (getGameSyncModel(change.model).deletion === "event-ephemeral") {
      this.handlers?.onEvent(toEntity(change));
      return [];
    }

    const identity = rowIdentity(change.model, change.key);
    if (preconfirmed) this.pendingRows.add(identity);
    else this.confirmedRows.set(identity, change);
    this.currentRows.set(identity, change);
    return [toEntity(change)];
  }

  private acceptDelete(change: HeraldDelete, preconfirmed: boolean): GameSyncEntity[] {
    if (getGameSyncModel(change.model).deletion === "event-ephemeral") return [];

    const identity = rowIdentity(change.model, change.key);
    if (preconfirmed) this.pendingRows.add(identity);
    else this.confirmedRows.delete(identity);
    this.currentRows.delete(identity);
    return [toRemoval(change)];
  }

  private resetOverlay(): void {
    this.pendingRows.forEach((identity) => {
      const current = this.currentRows.get(identity);
      const confirmed = this.confirmedRows.get(identity);
      if (confirmed) {
        this.currentRows.set(identity, confirmed);
        this.handlers?.onEntity(toEntity(confirmed));
      } else if (current) {
        this.currentRows.delete(identity);
        this.handlers?.onEntity(toRemoval(current));
      }
    });
    this.pendingRows.clear();
  }

  private acceptTransaction(message: Extract<HeraldMessage, { type: "tx" }>): void {
    const transaction: GameSyncTransaction = {
      block: message.block,
      hash: message.hash,
      status: message.status,
      ...(message.revert_reason ? { revertReason: message.revert_reason } : {}),
    };
    this.handlers?.onTransaction?.(transaction);
  }

  private acceptHead(message: Extract<HeraldMessage, { type: "head" }>): void {
    const head: GameSyncHead = { block: message.block, timestamp: message.timestamp };
    this.handlers?.onHead?.(head);
  }

  private reconcileSnapshot(rows: Map<string, StoredRow>): void {
    this.currentRows.forEach((row, identity) => {
      if (!rows.has(identity)) this.handlers?.onEntity(toRemoval(row));
    });
    rows.forEach((row) => this.handlers?.onEntity(toEntity(row)));
    this.replaceState(rows);
  }

  private replaceState(rows: Map<string, StoredRow>): void {
    this.confirmedRows.clear();
    this.currentRows.clear();
    rows.forEach((row, identity) => {
      this.confirmedRows.set(identity, row);
      this.currentRows.set(identity, row);
    });
    this.pendingRows.clear();
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

  private stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    const socket = this.socket;
    this.socket = undefined;
    socket?.close();
  }
}
