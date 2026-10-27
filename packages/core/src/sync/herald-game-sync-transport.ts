import type { GameSyncModelDefinition } from "./model-manifest";
import { HERALD_GAME_FINALIZED_CLOSE, HeraldHttpError, type HeraldGameSnapshot } from "./herald-http-types";
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
  | (HeraldMessageBase & { type: "scope"; actor?: string; visit?: string; expedition: boolean; set: HeraldSet[] })
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
  /**
   * A finalized game's final state, every row of it (Herald's review snapshot), read once Herald closes the stream as
   * finalized: a session already showing the game ends whole on it, and a spectator opening a finished game starts on
   * it. A player opening a finished game is refused (its results hold it).
   */
  finalState?: () => Promise<HeraldGameSnapshot>;
  gameId: number;
  modelDefinition: (name: string) => GameSyncModelDefinition;
  /** Herald greeted the stream (true), or the socket was lost and is being retried (false). */
  onConnection?: (reachable: boolean) => void;
  socketFactory?: (url: string) => HeraldSocket;
  url: string;
}

// A lost stream is retried at once, then less and less often while Herald stays away (each box deploy recreates it):
// every client of a game loses it in the same second, so the retries also spread out.
const RECONNECT_FIRST_MS = 200;
const RECONNECT_MAX_MS = 5_000;
// A stalled browser WebSocket handshake took 31 seconds before retrying during entry profiling.
const HELLO_TIMEOUT_MS = 10_000;
// Herald heads a live stream at least twice a second (prod, 2026-10-25: 90 heads in 60 s, none over 0.6 s apart). A live
// stream silent this long is gone though its socket never closed, as a phone's is once its tab has slept.
const SILENT_STREAM_MS = 10_000;
const SILENCE_CHECK_MS = 1_000;
// Every client of a game reads its final state in the same second: retries back off and spread out.
const FINAL_STATE_RETRY_FIRST_MS = 1_000;
const FINAL_STATE_RETRY_MAX_MS = 30_000;

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

/** When a finalized game ended, by its registry's own clock, in seconds; undefined when the snapshot holds none. */
const endOf = (snapshot: HeraldGameSnapshot): number | undefined => {
  const endAt = snapshot.models.find(({ model }) => model === "GameRegistry")?.rows[0]?.value.end_at;
  return typeof endAt === "string" || typeof endAt === "number" ? Number(BigInt(endAt)) : undefined;
};

/** Who the stream serves: the acting account (null for a spectator) and the player whose realm it visits, if any. */
interface ScopeSelection {
  actor: string | null;
  visit: string | null;
}

const canonicalAddress = (address: string | undefined): string | null =>
  address === undefined ? null : `0x${BigInt(address).toString(16)}`;

const sameSelection = (left: ScopeSelection, right: ScopeSelection): boolean =>
  left.actor === right.actor && left.visit === right.visit;

/** The stream URL carries the selection, so a reconnect resumes the same actor and visit. */
const selectionOf = (streamUrl: string): ScopeSelection => {
  const { searchParams } = new URL(streamUrl);
  return { actor: searchParams.get("actor"), visit: searchParams.get("visit") };
};

const withSelection = (streamUrl: string, selection: ScopeSelection): string => {
  const url = new URL(streamUrl);
  for (const [name, value] of Object.entries(selection))
    if (value === null) url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  return url.toString();
};

/** The game is over and finalized: its stream is closed for good, and its results hold the final state. */
export class GameFinalizedError extends Error {
  constructor(url: string) {
    super(`The game at ${url} is finalized; its review holds the final state`);
    this.name = "GameFinalizedError";
  }
}

/**
 * Herald's stream, forwarded in order: snapshots, scope replacements and diffs become store facts, event rows become
 * events. The transport keeps no copy of the rows it forwards; the native store is the one place they live.
 */
export class HeraldGameSyncTransport implements GameSyncTransport {
  public readonly transactionStatusChannel = true;
  private readonly socketFactory: (url: string) => HeraldSocket;
  private handlers?: GameSyncSubscriptionHandlers;
  private ready = deferred<void>();
  private socket?: HeraldSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  /** Attempts since Herald last greeted the stream: each one waits twice as long, up to the cap. */
  private failedReconnects = 0;
  private helloTimer?: ReturnType<typeof setTimeout>;
  private silenceTimer?: ReturnType<typeof setInterval>;
  /** Wall time of the socket's last message: it runs on while a phone sleeps, where the page's own clock may not. */
  private lastHeardAt = 0;
  private pendingSelection?: ScopeSelection;
  private resumed = false;
  private epoch = "";
  private seq = 0;
  private attachedThroughBlock = Number.MAX_SAFE_INTEGER;
  private stopped = true;
  /** Herald finalized the game: its archived final state, once applied, is the whole session; no stream follows. */
  private finalized = false;
  /** A spectator's start waiting on its final state: its subscription's own, settled when that read ends or is cancelled. */
  private finalStart: Deferred<void> | null = null;
  private forceFreshSnapshot = true;
  private firstSnapshotEnded = false;
  private snapshotStreaming = false;
  private acceptingSnapshotOverlay = false;
  private snapshotBytesReceived = 0;
  private snapshotModelsReceived = 0;
  private snapshotRowsReceived = 0;
  private snapshotSelection: ScopeSelection = { actor: null, visit: null };
  private completeActor: string | null | undefined;
  private completeVisit: string | null = null;
  private actorSnapshotGeneration = 0;

  constructor(private readonly options: HeraldGameSyncTransportOptions) {
    this.socketFactory = options.socketFactory ?? ((url) => new WebSocket(url) as unknown as HeraldSocket);
  }

  /**
   * The scope this client streams: the acting account and, while visiting, another player's realm. The pair is replaced
   * whole, so selecting an actor without a visit leaves any visit, as Herald reads it.
   */
  public selectActor(actor: string | undefined, visit?: string): void {
    const selection = { actor: canonicalAddress(actor), visit: canonicalAddress(visit) };
    if (sameSelection(selectionOf(this.options.url), selection)) return;
    if (this.finalized) return this.selectInFinalState(selection);
    this.completeActor = undefined;
    this.publishSnapshotState();
    this.actorSnapshotGeneration++;
    this.options.url = withSelection(this.options.url, selection);
    this.pendingSelection = selection;
    this.sendActorSelection();
  }

  /**
   * Chain time for the scope's absence, from the stream's heads; unknown from a fresh snapshot until its first head. A
   * diff leaves it alone: Herald sends a scope a diff moves whole in that diff, so the rows and the clock still agree,
   * and a player's own action never turns every absent row (no Essence yet, an army carrying nothing) unknown.
   */
  private scopeTimestamp: number | undefined;

  public completedTimestamp(): number | undefined {
    return this.scopeTimestamp;
  }

  /** Undefined until the current actor's entire scope has applied; null is a completed spectator snapshot. */
  public completedActor(): string | null | undefined {
    return this.completeActor;
  }

  /** The store's gate: whether the selected scope is complete, and for which actor and visit. */
  private publishSnapshotState(actor = this.completeActor, visit = this.completeVisit): void | Promise<void> {
    return this.handlers?.onSnapshotState?.({
      gameId: this.options.gameId,
      complete: actor !== undefined,
      actor,
      ...(visit === null ? {} : { visit }),
      timestamp: this.completedTimestamp(),
    });
  }

  private showsComplete(selection: ScopeSelection): boolean {
    return (
      this.completeActor !== undefined &&
      sameSelection({ actor: this.completeActor, visit: this.completeVisit }, selection)
    );
  }

  private finishActorSnapshot(selection: ScopeSelection, applied: boolean | Promise<boolean> | undefined): void {
    const { actor, visit } = selection;
    const generation = ++this.actorSnapshotGeneration;
    const current = () => !this.stopped && generation === this.actorSnapshotGeneration;
    const complete = (applied: boolean | undefined) => {
      if (!current()) return;
      if (!sameSelection(selectionOf(this.options.url), selection)) return;
      if (applied !== true) return;
      // The scope's rows are in the store, so the selection is complete from here: a head arriving before the gate
      // write lands must publish it complete, not shut the gate again until the next head.
      this.completeActor = actor;
      this.completeVisit = visit;
      void this.publishSnapshotState();
    };
    if (typeof applied === "boolean" || applied === undefined) complete(applied);
    // A failed application leaves the scope incomplete; the stream's own failure handling reports it.
    else void applied.then(complete, () => undefined);
  }

  /**
   * A finished game holds every scope's rows (its archive is the whole game), so an account connecting or leaving, or
   * a realm visited, needs no stream: the gate follows the selection and stays open once the final state is in.
   */
  private selectInFinalState(selection: ScopeSelection): void {
    this.options.url = withSelection(this.options.url, selection);
    if (this.completeActor === undefined) return;
    this.completeActor = selection.actor;
    this.completeVisit = selection.visit;
    void this.publishSnapshotState();
  }

  private sendActorSelection(): void {
    if (!this.resumed || !this.socket || this.pendingSelection === undefined) return;
    const { actor, visit } = this.pendingSelection;
    this.socket.send(JSON.stringify({ type: "select_actor", actor, visit }));
    this.pendingSelection = undefined;
  }

  public async subscribe(handlers: GameSyncSubscriptionHandlers): Promise<GameSyncWriter> {
    this.cancelFinalStart("replaced");
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
    this.finalized = false;
    this.finalStart = null;
    this.failedReconnects = 0;
  }

  private connect(): void {
    if (this.stopped) return;
    this.resumed = false;
    this.snapshotSelection = selectionOf(this.options.url);
    const socket = this.socketFactory(this.options.url);
    this.socket = socket;
    this.helloTimer = setTimeout(() => {
      if (this.socket !== socket) return;
      console.warn(`[Herald] No hello within ${HELLO_TIMEOUT_MS}ms; reconnecting`);
      this.reconnectSocket(socket);
    }, HELLO_TIMEOUT_MS);
    this.lastHeardAt = Date.now();
    this.silenceTimer = setInterval(() => this.reconnectIfSilent(socket), SILENCE_CHECK_MS);
    socket.onmessage = ({ data }) => {
      if (this.socket !== socket) return;
      this.lastHeardAt = Date.now();
      this.acceptMessage(data);
    };
    socket.onerror = () => this.reconnectSocket(socket);
    socket.onclose = (event) =>
      event?.code === HERALD_GAME_FINALIZED_CLOSE ? this.endFinalized(socket) : this.reconnectSocket(socket);
  }

  /**
   * Herald will never serve a finalized game again, so the stream ends instead of reconnecting. A session already
   * showing the game ends whole on its final state (the stream may have ended mid-snapshot, and a store left incomplete
   * reads every absent row, a player who never scored, as unknown); a spectator opening a finished game starts on it;
   * a player opening one is refused.
   */
  private endFinalized(socket: HeraldSocket): void {
    if (this.socket !== socket) return;
    const clock = this.scopeTimestamp;
    // Stopping shuts the store's gate; the final state opens it again.
    this.stop();
    this.finalized = true;
    const failure = new GameFinalizedError(this.options.url);
    console.warn(`[Herald] ${failure.message}; not reconnecting`);
    if (this.firstSnapshotEnded) void this.applyFinalState({ clock });
    else if (selectionOf(this.options.url).actor === null) {
      this.finalStart = this.ready;
      void this.applyFinalState({ failure });
    } else this.failStart(failure);
  }

  /**
   * A start still reading its final state is its subscription's own: disposing or replacing that subscription settles
   * it, though its socket was already stopped for the read.
   */
  private cancelFinalStart(how: "disposed" | "replaced"): void {
    const start = this.finalStart;
    this.finalStart = null;
    start?.reject(new Error(`Herald transport was ${how} before its final state was read`));
  }

  private failStart(failure: Error): void {
    if (!this.ready.settled) this.ready.reject(failure);
    else if (!this.firstSnapshotEnded) this.handlers?.onStartFailure(failure);
  }

  /**
   * The game's final state as one snapshot through the same handlers a stream's snapshot reaches, then the store's
   * gate opened on it for the selected scope. A game that was shown keeps the last chain time its stream reported; a
   * start on the final state takes the game's own end as its one head, before any row reads chain time, and is refused
   * as finalized when the final state holds no end or Herald refuses it (a review never frozen stays so). A read that
   * fails otherwise is retried, as a dropped stream reconnects, until it answers. A session cancelled or restarted
   * meanwhile takes nothing.
   */
  private async applyFinalState(start: { clock: number | undefined } | { failure: GameFinalizedError }): Promise<void> {
    const handlers = this.handlers;
    const generation = this.actorSnapshotGeneration;
    const current = () => handlers === this.handlers && generation === this.actorSnapshotGeneration;
    // A refusal is the starting subscription's alone: one cancelled or replaced meanwhile is never failed by it.
    const refuse = () => {
      if (!("failure" in start) || !current()) return;
      this.finalStart = null;
      this.failStart(start.failure);
    };
    const read = this.options.finalState;
    if (!handlers || !read) return refuse();
    let final: HeraldGameSnapshot;
    for (let delay = FINAL_STATE_RETRY_FIRST_MS; ; delay = Math.min(delay * 2, FINAL_STATE_RETRY_MAX_MS)) {
      try {
        final = await read();
        break;
      } catch (error) {
        if (!current()) return;
        if (error instanceof HeraldHttpError && error.permanent) {
          console.warn(`[Herald] the final state of ${this.options.url} was refused`, error);
          return refuse();
        }
        console.warn(`[Herald] the final state of ${this.options.url} could not be read; retrying`, error);
      }
      await new Promise((resolve) => setTimeout(resolve, delay * (0.5 + Math.random() / 2)));
      if (!current()) return;
    }
    if (!current()) return;
    const clock = "clock" in start ? start.clock : endOf(final);
    if (!("clock" in start)) {
      if (clock === undefined) {
        console.warn(`[Herald] the final state of ${this.options.url} holds no GameRegistry end`);
        return refuse();
      }
      this.finalStart = null;
      this.ready.resolve();
      handlers.onHead({ block: final.confirmed_block, preconfirmed: false, timestamp: clock });
    }
    handlers.onSnapshotStart();
    let rowsReceived = 0;
    final.models.forEach(({ model, rows }, index) => {
      rowsReceived += rows.length;
      handlers.onSnapshotModel(
        model,
        rows.map((row) => toFact({ ...row, model })),
        { bytesReceived: 0, model, modelsReceived: index + 1, rowsReceived },
      );
    });
    this.firstSnapshotEnded = true;
    if ((await handlers.onSnapshotEnd(final.confirmed_block)) !== true || !current()) return;
    const { actor, visit } = selectionOf(this.options.url);
    this.scopeTimestamp = clock;
    this.completeActor = actor;
    this.completeVisit = visit;
    await this.publishSnapshotState();
  }

  private reconnectSocket(socket: HeraldSocket): void {
    if (this.socket !== socket) return;
    this.closeSocket();
    this.options.onConnection?.(false);
    // A snapshot cut short can only be completed by a fresh one.
    if (this.snapshotStreaming || this.completeActor === undefined) this.forceFreshSnapshot = true;
    this.actorSnapshotGeneration++;
    this.snapshotStreaming = false;
    this.scheduleReconnect();
  }

  /** A live stream that has gone silent is dropped and resumed, as a closed one is. */
  private reconnectIfSilent(socket: HeraldSocket): void {
    if (this.socket !== socket || !this.isLive() || Date.now() - this.lastHeardAt < SILENT_STREAM_MS) return;
    console.warn(`[Herald] Nothing heard for ${SILENT_STREAM_MS}ms; reconnecting`);
    this.reconnectSocket(socket);
  }

  /** Past the handshake and the snapshot: from here Herald heads the stream twice a second. */
  private isLive(): boolean {
    return this.resumed && this.firstSnapshotEnded && !this.snapshotStreaming && !this.forceFreshSnapshot;
  }

  private clearHelloTimer(): void {
    if (this.helloTimer !== undefined) clearTimeout(this.helloTimer);
    this.helloTimer = undefined;
  }

  private closeSocket(): void {
    this.clearHelloTimer();
    clearInterval(this.silenceTimer);
    this.silenceTimer = undefined;
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
    this.failedReconnects = 0;
    this.options.onConnection?.(true);
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
    const selection = { actor: canonicalAddress(message.actor), visit: canonicalAddress(message.visit) };
    // A new scope for the selection on screen (the player's own, after each move, build or deploy) replaces its rows in
    // one write: the gate stays open and every fact shown stays known until then. Only another selection's scope
    // shuts it.
    if (!this.showsComplete(selection)) {
      this.completeActor = undefined;
      this.publishSnapshotState();
    }
    const applied = this.handlers?.onScope(message.set.map(toFact), message.expedition);
    this.finishActorSnapshot(selection, applied);
    this.epoch = message.epoch;
    this.seq = message.seq;
    this.acceptingSnapshotOverlay = true;
  }

  private acceptSnapshotModel(message: Extract<HeraldMessage, { type: "snapshot" }>, bytesReceived: number): void {
    if (!this.snapshotStreaming) {
      this.scopeTimestamp = undefined;
      this.completeActor = undefined;
      this.publishSnapshotState();
      this.actorSnapshotGeneration++;
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
    this.completeActor = undefined;
    this.publishSnapshotState();
    if (!this.snapshotStreaming) {
      this.scopeTimestamp = undefined;
      this.handlers?.onSnapshotStart();
    }
    this.snapshotStreaming = false;
    this.firstSnapshotEnded = true;
    this.finishActorSnapshot(this.snapshotSelection, this.handlers?.onSnapshotEnd(this.attachedThroughBlock));
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
      ...(message.revert_reason ? { revertReason: message.revert_reason } : {}),
    };
    this.handlers?.onTransaction(transaction);
  }

  private acceptHead(message: Extract<HeraldMessage, { type: "head" }>): void {
    this.scopeTimestamp = Math.max(this.scopeTimestamp ?? 0, message.timestamp);
    this.publishSnapshotState();
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
    const delay = Math.min(RECONNECT_FIRST_MS * 2 ** this.failedReconnects, RECONNECT_MAX_MS);
    this.failedReconnects += 1;
    this.reconnectTimer = setTimeout(
      () => {
        this.reconnectTimer = undefined;
        this.connect();
      },
      delay * (0.5 + Math.random() / 2),
    );
  }

  /** Stops reconnecting and fails a subscribe or first snapshot still waiting on the socket. */
  public dispose(): void {
    const wasRunning = !this.stopped;
    this.cancelFinalStart("disposed");
    this.stop();
    if (!wasRunning) return;
    const failure = new Error("Herald transport was disposed before its subscription became active");
    if (!this.ready.settled) this.ready.reject(failure);
    else if (!this.firstSnapshotEnded) this.handlers?.onStartFailure(failure);
  }

  private stop(): void {
    this.stopped = true;
    this.scopeTimestamp = undefined;
    this.completeActor = undefined;
    this.publishSnapshotState();
    this.actorSnapshotGeneration++;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = undefined;
    this.closeSocket();
  }
}
