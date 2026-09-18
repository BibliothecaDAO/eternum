import { NativeReceiptRejected, type NativeIngestion } from "./native/ingestion";
import { normalizeFelt, type ModelRegistry } from "./model-registry";
import type { CheckpointStore } from "./checkpoint-store";
import { DiffLatencyMonitor } from "./diff-latency";
import { GameStreamHub, type GameStreamSession, type SnapshotOverlayDiff, type StreamSocket } from "./game-stream";
import { MadaraRpc } from "./madara-rpc";
import { collapseChanges, OverlayLedger } from "./overlay-ledger";
import type { ResumeRequest } from "./stream-protocol";
import type {
  FoldChange,
  FoldDelete,
  FoldSet,
  GameSnapshot,
  RpcHead,
  RpcReceipt,
  RpcSubscribedTransaction,
  RpcTransaction,
} from "./types";
import { WorldFold } from "./world-fold";
import type { HistoryStore } from "./history-store";

export interface LiveWorldInput {
  chain: string;
  checkpointEveryBlocks: number;
  checkpointStore: Pick<CheckpointStore, "save">;
  checkpointBlock?: number;
  confirmedBlock: number;
  confirmedFold: WorldFold;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  hub?: GameStreamHub;
  diffLatency?: DiffLatencyMonitor;
  historyStore?: HistoryStore;
}

interface GameChanges {
  del: FoldDelete[];
  set: FoldSet[];
}

interface OverlayTransaction {
  block: number | null;
  changes: FoldChange[];
  transactionHash: string;
}

const MAX_PENDING_TRANSACTION_ENTRIES = 2_048;
const MAX_RECEIPTS_PER_TRANSACTION = 4;

const setBoundedTransactionEntry = <Value>(map: Map<string, Value>, key: string, value: Value): void => {
  map.delete(key);
  map.set(key, value);
  while (map.size > MAX_PENDING_TRANSACTION_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) return;
    map.delete(oldest);
  }
};

export class LiveWorld {
  private readonly changeListeners = new Set<(models: ReadonlySet<string>) => void>();

  public readonly hub: GameStreamHub;

  private confirmedFold: WorldFold;

  private overlayFold: WorldFold;

  private confirmedBlockValue: number;

  private preconfirmedBlockValue: number | null = null;

  private lastClockTimestamp = 0;

  private lastCheckpointBlock: number;

  private checkpointFailure?: Error;

  private checkpointInFlight = false;

  private checkpointWrite = Promise.resolve();

  private readonly knownGames = new Set<string>();

  private readonly overlayEvents = new Set<string>();

  private readonly transactionSenders = new Map<string, string | null>();

  private readonly pendingReceipts = new Map<string, RpcReceipt[]>();

  private readonly overlayTransactions: OverlayTransaction[] = [];

  private readonly overlayLedger = new OverlayLedger();

  private readonly diffLatency: DiffLatencyMonitor;

  private readonly transactionGames = new Map<string, string[]>();

  private readonly native: NativeIngestion;

  constructor(private readonly input: LiveWorldInput & { native: NativeIngestion }) {
    this.native = input.native;
    this.hub = input.hub ?? new GameStreamHub();
    this.diffLatency = input.diffLatency ?? new DiffLatencyMonitor();
    this.confirmedFold = input.confirmedFold;
    this.overlayFold = input.confirmedFold.overlay();
    this.confirmedBlockValue = input.confirmedBlock;
    this.lastCheckpointBlock = input.checkpointBlock ?? input.confirmedBlock;
  }

  public subscribeConfirmedChanges(listener: (models: ReadonlySet<string>) => void): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  public get confirmedBlock(): number {
    return this.confirmedBlockValue;
  }

  public get chainTimestamp(): number {
    return this.lastClockTimestamp;
  }

  public get preconfirmedBlock(): number | null {
    return this.preconfirmedBlockValue;
  }

  public snapshot(gameId: string, models?: readonly string[], actor?: string): GameSnapshot {
    return this.confirmedFold.snapshot(gameId, this.confirmedBlockValue, models, actor);
  }

  public modelRows(model: string) {
    return this.confirmedFold.modelRows(model);
  }

  public async freezeFinalizedReviewSnapshots(): Promise<void> {
    if (!this.input.historyStore) return;
    await Promise.all(
      this.confirmedFold
        .finalizedGameIds()
        .map((gameId) =>
          this.input.historyStore!.freezeReviewSnapshot(gameId, () =>
            this.confirmedFold.reviewSnapshot(gameId, this.confirmedBlockValue),
          ),
        ),
    );
  }

  public attach(gameId: string, socket: StreamSocket, actor?: string): GameStreamSession {
    this.knownGames.add(gameId);
    return this.hub.attach({
      confirmedBlock: this.confirmedBlockValue,
      gameId,
      overlay: () => this.snapshotOverlay(gameId),
      preconfirmedBlock: this.preconfirmedBlockValue,
      snapshot: () => this.snapshot(gameId, undefined, actor),
      socket,
    });
  }

  public resume(session: GameStreamSession, request: ResumeRequest): void {
    this.hub.resume(session, request);
  }

  public detach(session: GameStreamSession): void {
    this.hub.detach(session);
  }

  public acceptTransaction(message: RpcSubscribedTransaction): void {
    const transaction = message.transaction ?? message;
    const transactionHash = message.transaction_hash ?? transaction.transaction_hash;
    if (!transactionHash) throw new Error("Subscribed transaction has no transaction hash");
    this.recordTransactionSender(transactionHash, transaction);
  }

  public async checkpoint(): Promise<void> {
    await this.checkpointWrite;
    if (this.checkpointFailure) throw this.checkpointFailure;
    await this.input.checkpointStore.save(this.input.chain, this.confirmedBlockValue, this.confirmedFold);
    this.lastCheckpointBlock = this.confirmedBlockValue;
  }

  public acceptReceipt(receipt: RpcReceipt): void {
    if (this.native.halted) return;
    if (receipt.finality_status === "PRE_CONFIRMED" && !this.applyOverlayReceipt(receipt, null, 0)) return;
    let actionReceipt: RpcReceipt;
    try {
      actionReceipt = this.native.actionReceipt(this.overlayFold, receipt);
    } catch (error) {
      const confirmed = receipt.finality_status !== "PRE_CONFIRMED";
      this.native.rejectReceipt(receipt, receipt.block_number ?? null, error, confirmed);
      if (confirmed) {
        this.resetOverlay();
        this.publishOverlayReverts();
      }
      return;
    }
    // Ticket rejections do not change the enclosing transaction or its other outcomes.
    this.publishReceiptStatus(actionReceipt);
  }

  public async publishChainClock(): Promise<void> {
    if (!this.native.halted) await this.publishClock();
  }

  public async acceptSubscribedHead(head: RpcHead): Promise<void> {
    await this.reconcileOrHalt(() => this.applySubscribedHead(head));
  }

  public async reconcileAfterSubscribe(): Promise<void> {
    await this.reconcileOrHalt(() => this.reconcileCurrentHead());
  }

  private async publishClock(): Promise<void> {
    if (this.knownGames.size === 0) return;
    const header = await this.input.rpc.getPreconfirmedHeader();
    if (header.timestamp <= this.lastClockTimestamp) return;
    this.lastClockTimestamp = header.timestamp;
    for (const gameId of this.knownGames) this.hub.publishHead(gameId, header.block_number, header.timestamp, true);
  }

  private async applySubscribedHead(head: RpcHead): Promise<void> {
    if (head.block_number <= this.confirmedBlockValue) return;
    await this.reconcileHead(head);
  }

  private publishReceiptStatus(receipt: RpcReceipt): void {
    const transactionHash = normalizeFelt(receipt.transaction_hash);
    if (!this.transactionSenders.has(transactionHash)) {
      const pending = this.pendingReceipts.get(transactionHash) ?? [];
      pending.push(receipt);
      setBoundedTransactionEntry(this.pendingReceipts, transactionHash, pending.slice(-MAX_RECEIPTS_PER_TRANSACTION));
      return;
    }

    this.publishTransactionReceipt(transactionHash, this.transactionSenders.get(transactionHash), receipt);
  }

  private async reconcileCurrentHead(): Promise<void> {
    const blockNumber = await this.input.rpc.blockNumber();
    const block = await this.input.rpc.getBlockWithReceipts(blockNumber);
    await this.reconcileHead({ block_number: block.block_number, timestamp: block.timestamp });
  }

  private async reconcileHead(head: RpcHead): Promise<void> {
    if (this.checkpointFailure) throw this.checkpointFailure;
    if (head.block_number < this.confirmedBlockValue) return;
    const startedAt = performance.now();

    const confirmedChanges = await this.applyConfirmedThrough(head.block_number);
    await this.freezeFinalizedReviewSnapshots();
    for (const [block, changes] of confirmedChanges) this.broadcastConfirmedChanges(changes, block);
    this.resetOverlay();
    await this.rebuildOverlay();
    this.publishOverlayReverts();
    this.diffLatency.record("confirmed", performance.now() - startedAt);
    this.lastClockTimestamp = Math.max(this.lastClockTimestamp, head.timestamp);
    for (const gameId of this.knownGames) this.hub.publishHead(gameId, head.block_number, head.timestamp);
    this.checkpointIfDue();
  }

  private broadcastConfirmedChanges(changes: FoldChange[], block: number): void {
    const published = this.overlayLedger.settleConfirmed(collapseChanges(changes));
    this.broadcastChanges(published, block, false);
    if (this.changeListeners.size && changes.length) {
      const models = new Set(changes.map((change) => (change.set ?? change.del)!.model));
      for (const listener of this.changeListeners) listener(models);
    }
  }

  private resetOverlay(): void {
    this.overlayFold = this.confirmedFold.overlay();
    this.overlayEvents.clear();
    this.overlayTransactions.length = 0;
    this.overlayLedger.reset();
    for (const gameId of this.knownGames) this.hub.publishOverlayReset(gameId, this.confirmedBlockValue);
  }

  private publishOverlayReverts(): void {
    const reverts = this.overlayLedger.settleReverts((model, key) => this.confirmedFold.currentRow(model, key));
    this.broadcastChanges(reverts, this.preconfirmedBlockValue, true);
  }

  private broadcastChanges(
    changes: FoldChange[],
    block: number | null,
    preconfirmed: boolean,
    transactionHash?: string,
  ): void {
    const byGame = new Map<string, GameChanges>();
    this.groupChanges(byGame, changes);
    this.publishGroupedChanges(byGame, block, preconfirmed, transactionHash);
  }

  private groupChanges(byGame: Map<string, GameChanges>, changes: FoldChange[]): void {
    for (const change of changes) {
      const gameIds = change.gameId === undefined ? this.knownGames : [change.gameId];
      for (const gameId of gameIds) {
        const grouped = byGame.get(gameId) ?? { del: [], set: [] };
        if (change.set) grouped.set.push(change.set);
        if (change.del) grouped.del.push(change.del);
        byGame.set(gameId, grouped);
      }
    }
  }

  private publishGroupedChanges(
    byGame: Map<string, GameChanges>,
    block: number | null,
    preconfirmed: boolean,
    transactionHash?: string,
  ): void {
    for (const [gameId, grouped] of byGame) {
      this.hub.publishDiff(gameId, {
        block,
        del: grouped.del,
        preconfirmed,
        set: grouped.set,
        ...(transactionHash ? { transaction_hash: transactionHash } : {}),
      });
    }
  }

  private publishOverlayTransaction(transaction: OverlayTransaction): void {
    const changes = collapseChanges(transaction.changes);
    if (changes.length === 0) return;
    this.overlayTransactions.push({ ...transaction, changes });
    const delta = this.overlayLedger.delta(changes, (model, key) => this.confirmedFold.currentRow(model, key));
    this.broadcastChanges(delta, transaction.block, true, transaction.transactionHash);
  }

  private snapshotOverlay(gameId: string): SnapshotOverlayDiff[] {
    return this.overlayTransactions.flatMap(({ block, changes, transactionHash }) => {
      const grouped = new Map<string, GameChanges>();
      this.groupChanges(grouped, changes);
      const gameChanges = grouped.get(gameId);
      return gameChanges ? [{ block, transaction_hash: transactionHash, ...gameChanges }] : [];
    });
  }

  private recordSenderAndPublishPending(
    transactionHashValue: string,
    transaction: Pick<RpcTransaction, "contract_address" | "sender_address">,
  ): void {
    const transactionHash = normalizeFelt(transactionHashValue);
    const address = transaction.sender_address ?? transaction.contract_address;
    const sender = address ? normalizeFelt(address) : null;
    setBoundedTransactionEntry(this.transactionSenders, transactionHash, sender);
    const pending = this.pendingReceipts.get(transactionHash) ?? [];
    this.pendingReceipts.delete(transactionHash);
    pending.forEach((receipt) => this.publishTransactionReceipt(transactionHash, sender, receipt));
  }

  private checkpointIfDue(): void {
    if (this.checkpointInFlight) return;
    if (this.confirmedBlockValue - this.lastCheckpointBlock < this.input.checkpointEveryBlocks) return;
    const confirmedBlock = this.confirmedBlockValue;
    const startedAt = performance.now();
    this.lastCheckpointBlock = confirmedBlock;
    this.checkpointInFlight = true;
    this.checkpointWrite = this.input.checkpointStore
      .save(this.input.chain, confirmedBlock, this.confirmedFold)
      .then(() => {
        console.info(
          JSON.stringify({
            confirmedBlock,
            durationMs: Math.round(performance.now() - startedAt),
            event: "herald_checkpoint_saved",
          }),
        );
      })
      .catch((error) => {
        this.checkpointFailure = error instanceof Error ? error : new Error(String(error));
      })
      .finally(() => {
        this.checkpointInFlight = false;
      });
  }

  private async reconcileOrHalt(reconcile: () => Promise<void>): Promise<void> {
    if (this.native.halted) return;
    try {
      await reconcile();
    } catch (error) {
      if (!(error instanceof NativeReceiptRejected)) throw error;
      this.resetOverlay();
      this.publishOverlayReverts();
    }
  }

  private async applyConfirmedThrough(target: number): Promise<Map<number, FoldChange[]>> {
    const result = await this.native.replay({
      fold: this.confirmedFold,
      rpc: this.input.rpc,
      fromBlock: this.confirmedBlockValue + 1,
      toBlock: target,
    });
    await this.input.historyStore?.appendEvents(
      result.events.filter((event) => event.kind === "event"),
      target,
    );
    this.confirmedBlockValue = target;
    return result.changes;
  }

  private async rebuildOverlay(): Promise<void> {
    const block = await this.input.rpc.getBlockWithReceipts("pre_confirmed");
    this.preconfirmedBlockValue = block.block_number;
    for (const { receipt, transaction } of block.transactions)
      this.recordTransactionSender(receipt.transaction_hash, transaction);
    for (const { receipt, transactionIndex } of this.native.receipts(block))
      this.applyOverlayReceipt(receipt, block.block_number, transactionIndex);
  }

  private applyOverlayReceipt(receipt: RpcReceipt, block: number | null, index: number): boolean {
    const identity = `receipt:${normalizeFelt(receipt.transaction_hash)}`;
    if (this.overlayEvents.has(identity)) return true;
    let result: ReturnType<NativeIngestion["applyReceipt"]>;
    try {
      result = this.native.applyReceipt(this.overlayFold, receipt, block, index);
    } catch (error) {
      this.native.rejectReceipt(receipt, block, error, false);
      return false;
    }
    this.overlayEvents.add(identity);
    this.publishOverlayTransaction({
      block,
      changes: result.changes.flatMap(({ change }) => (change ? [change] : [])),
      transactionHash: normalizeFelt(receipt.transaction_hash),
    });
    return true;
  }

  private recordTransactionSender(
    hash: string,
    transaction: Pick<RpcTransaction, "contract_address" | "sender_address" | "calldata">,
  ): void {
    const identity = normalizeFelt(hash);
    try {
      setBoundedTransactionEntry(this.transactionGames, identity, this.native.transactionGameIds(transaction));
    } catch (error) {
      this.native.rejectRouting(identity, error);
    }
    this.recordSenderAndPublishPending(hash, transaction);
  }

  private publishTransactionReceipt(hash: string, _sender: string | null | undefined, receipt: RpcReceipt): void {
    const status = receipt.execution_status === "REVERTED" ? "REVERTED" : receipt.finality_status;
    for (const gameId of this.transactionGames.get(hash) ?? []) {
      if (this.knownGames.has(gameId))
        this.hub.publishTransaction(gameId, {
          block: receipt.block_number ?? null,
          hash,
          revert_reason: receipt.revert_reason,
          ...(receipt.executions !== undefined
            ? { executions: receipt.executions.filter((outcome) => BigInt(outcome.gameId) === BigInt(gameId)) }
            : {}),
          status,
        });
      if (receipt.finality_status !== "PRE_CONFIRMED") this.input.historyStore?.recordTransaction(gameId, receipt);
    }
    if (receipt.finality_status !== "PRE_CONFIRMED") {
      this.transactionGames.delete(hash);
      this.transactionSenders.delete(hash);
      this.pendingReceipts.delete(hash);
    }
  }
}
