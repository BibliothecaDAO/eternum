import { normalizeFelt, type ModelRegistry } from "./model-registry";
import type { CheckpointStore } from "./checkpoint-store";
import { GameStreamHub, type GameStreamSession, type SnapshotOverlayDiff, type StreamSocket } from "./game-stream";
import { MadaraRpc } from "./madara-rpc";
import { replayWorldEvents } from "./snapshot-builder";
import type { ResumeRequest } from "./stream-protocol";
import type {
  DecodedWorldEvent,
  FoldChange,
  FoldDelete,
  FoldSet,
  GameSnapshot,
  RawWorldEvent,
  RpcBlockWithReceipts,
  RpcHead,
  RpcReceipt,
  RpcSubscribedEvent,
  RpcSubscribedTransaction,
  RpcTransaction,
} from "./types";
import type { WorldEventDecodeMonitor } from "./world-event-decoder";
import { WorldFold } from "./world-fold";
import type { HistoryStore } from "./history-store";

interface LiveWorldInput {
  chain: string;
  checkpointEveryBlocks: number;
  checkpointStore: Pick<CheckpointStore, "save">;
  checkpointBlock?: number;
  confirmedBlock: number;
  confirmedFold: WorldFold;
  registry: ModelRegistry;
  rpc: MadaraRpc;
  hub?: GameStreamHub;
  decodeMonitor: WorldEventDecodeMonitor;
  historyStore?: HistoryStore;
}

interface GameChanges {
  del: FoldDelete[];
  set: FoldSet[];
}

interface PendingPreconfirmedTransaction {
  changes: FoldChange[];
  eventIndexes: Set<number>;
  expectedEventIndexes?: Set<number>;
  transactionHash: string;
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
  public readonly hub: GameStreamHub;
  private confirmedFold: WorldFold;
  private overlayFold: WorldFold;
  private confirmedBlockValue: number;
  private preconfirmedBlockValue: number | null = null;
  private lastCheckpointBlock: number;
  private checkpointFailure?: Error;
  private checkpointInFlight = false;
  private checkpointWrite = Promise.resolve();
  private readonly knownGames = new Set<string>();
  private readonly overlayEvents = new Set<string>();
  private readonly preconfirmedReceiptEvents = new Map<string, Set<number>>();
  private readonly transactionSenders = new Map<string, string | null>();
  private readonly pendingReceipts = new Map<string, RpcReceipt[]>();
  private readonly overlayTransactions: OverlayTransaction[] = [];
  private pendingPreconfirmed?: PendingPreconfirmedTransaction;
  private pendingPreconfirmedFlush?: ReturnType<typeof setImmediate>;

  constructor(private readonly input: LiveWorldInput) {
    this.hub = input.hub ?? new GameStreamHub();
    this.confirmedFold = input.confirmedFold;
    this.overlayFold = input.confirmedFold.overlay();
    this.confirmedBlockValue = input.confirmedBlock;
    this.lastCheckpointBlock = input.checkpointBlock ?? input.confirmedBlock;
  }

  public get confirmedBlock(): number {
    return this.confirmedBlockValue;
  }

  public get preconfirmedBlock(): number | null {
    return this.preconfirmedBlockValue;
  }

  public snapshot(gameId: string, models?: readonly string[]): GameSnapshot {
    return this.confirmedFold.snapshot(gameId, this.confirmedBlockValue, models);
  }

  public modelRows(model: string) {
    return this.confirmedFold.modelRows(model);
  }

  public async freezeEndedReviewSnapshots(): Promise<void> {
    if (!this.input.historyStore) return;
    await Promise.all(
      this.confirmedFold
        .endedGameIds()
        .map((gameId) =>
          this.input.historyStore!.freezeReviewSnapshot(
            this.confirmedFold.reviewSnapshot(gameId, this.confirmedBlockValue),
          ),
        ),
    );
  }

  public attach(gameId: string, socket: StreamSocket): GameStreamSession {
    this.knownGames.add(gameId);
    return this.hub.attach({
      confirmedBlock: this.confirmedBlockValue,
      gameId,
      overlay: () => this.snapshotOverlay(gameId),
      preconfirmedBlock: this.preconfirmedBlockValue,
      snapshot: () => this.snapshot(gameId),
      socket,
    });
  }

  public resume(session: GameStreamSession, request: ResumeRequest): void {
    this.hub.resume(session, request);
  }

  public detach(session: GameStreamSession): void {
    this.hub.detach(session);
  }

  public async acceptSubscribedHead(head: RpcHead): Promise<void> {
    if (head.block_number <= this.confirmedBlockValue) return;
    await this.reconcileHead(head);
  }

  public acceptPreconfirmedEvent(event: RpcSubscribedEvent): void {
    if (event.finality_status !== "PRE_CONFIRMED") return;

    const transactionHash = normalizeFelt(event.transaction_hash);
    if (this.pendingPreconfirmed?.transactionHash !== transactionHash) this.flushPreconfirmedTransaction();

    const rawEvent = this.rawSubscribedEvent(event);
    this.pendingPreconfirmed ??= {
      changes: [],
      eventIndexes: new Set(),
      expectedEventIndexes: this.preconfirmedReceiptEvents.get(transactionHash),
      transactionHash,
    };
    this.preconfirmedReceiptEvents.delete(transactionHash);
    this.pendingPreconfirmed.eventIndexes.add(rawEvent.event_index);

    const change = this.applyOverlayEvent(rawEvent);
    if (change) this.pendingPreconfirmed.changes.push(change);
    this.flushCompletePreconfirmedTransaction();
  }

  public acceptReceipt(receipt: RpcReceipt): void {
    const transactionHash = normalizeFelt(receipt.transaction_hash);
    this.acceptPreconfirmedReceipt(transactionHash, receipt);
    if (!this.transactionSenders.has(transactionHash)) {
      const pending = this.pendingReceipts.get(transactionHash) ?? [];
      pending.push(receipt);
      setBoundedTransactionEntry(this.pendingReceipts, transactionHash, pending.slice(-MAX_RECEIPTS_PER_TRANSACTION));
      return;
    }

    this.publishTransactionReceipt(transactionHash, this.transactionSenders.get(transactionHash), receipt);
  }

  public acceptTransaction(message: RpcSubscribedTransaction): void {
    const transaction = message.transaction ?? message;
    const transactionHash = message.transaction_hash ?? transaction.transaction_hash;
    if (!transactionHash) throw new Error("Subscribed transaction has no transaction hash");
    this.recordTransactionSender(transactionHash, transaction);
  }

  private publishTransactionReceipt(
    transactionHash: string,
    sender: string | null | undefined,
    receipt: RpcReceipt,
  ): void {
    if (sender) {
      const status = receipt.execution_status === "REVERTED" ? "REVERTED" : receipt.finality_status;
      const gameIds = new Set([...this.knownGames, ...this.confirmedFold.gameIds()]);
      for (const gameId of gameIds) {
        if (!this.overlayFold.gameplayAccounts(gameId).has(sender)) continue;
        if (this.knownGames.has(gameId)) {
          this.hub.publishTransaction(gameId, {
            block: receipt.block_number ?? null,
            hash: transactionHash,
            revert_reason: receipt.revert_reason,
            status,
          });
        }
        if (receipt.finality_status !== "PRE_CONFIRMED") {
          this.input.historyStore?.recordTransaction(gameId, receipt);
        }
      }
    }

    if (receipt.finality_status !== "PRE_CONFIRMED") {
      this.transactionSenders.delete(transactionHash);
      this.pendingReceipts.delete(transactionHash);
    }
  }

  public async reconcileAfterSubscribe(): Promise<void> {
    const blockNumber = await this.input.rpc.blockNumber();
    const block = await this.input.rpc.getBlockWithReceipts(blockNumber);
    await this.reconcileHead({ block_number: block.block_number, timestamp: block.timestamp });
  }

  public async checkpoint(): Promise<void> {
    await this.checkpointWrite;
    if (this.checkpointFailure) throw this.checkpointFailure;
    await this.input.checkpointStore.save(this.input.chain, this.confirmedBlockValue, this.confirmedFold);
    this.lastCheckpointBlock = this.confirmedBlockValue;
  }

  private async reconcileHead(head: RpcHead): Promise<void> {
    if (this.checkpointFailure) throw this.checkpointFailure;
    if (head.block_number < this.confirmedBlockValue) return;

    this.flushPreconfirmedTransaction();

    const confirmedChanges = await this.applyConfirmedThrough(head.block_number);
    for (const [block, changes] of confirmedChanges) this.broadcastChanges(changes, block, false);
    this.resetOverlay();
    await this.rebuildOverlay();
    for (const gameId of this.knownGames) this.hub.publishHead(gameId, head.block_number, head.timestamp);
    this.checkpointIfDue();
  }

  private async applyConfirmedThrough(targetBlock: number): Promise<Map<number, FoldChange[]>> {
    if (targetBlock === this.confirmedBlockValue) return new Map();
    const changes = new Map<number, FoldChange[]>();
    const historyEvents: DecodedWorldEvent[] = [];
    await replayWorldEvents({
      applyAtomically: true,
      fold: this.confirmedFold,
      fromBlock: this.confirmedBlockValue + 1,
      onChange: (event, change) => {
        if (event.kind === "event") historyEvents.push(event);
        if (!change) return;
        const block = event.position.blockNumber;
        if (block === null) throw new Error("Confirmed getEvents result has a null block number");
        const blockChanges = changes.get(block) ?? [];
        blockChanges.push(change);
        changes.set(block, blockChanges);
      },
      decodeMonitor: this.input.decodeMonitor,
      registry: this.input.registry,
      rpc: this.input.rpc,
      toBlock: targetBlock,
    });
    await this.input.historyStore?.appendEvents(historyEvents, targetBlock);
    this.confirmedBlockValue = targetBlock;
    await this.freezeEndedReviewSnapshots();
    return changes;
  }

  private resetOverlay(): void {
    this.overlayFold = this.confirmedFold.overlay();
    this.overlayEvents.clear();
    this.preconfirmedReceiptEvents.clear();
    this.overlayTransactions.length = 0;
    for (const gameId of this.knownGames) this.hub.publishOverlayReset(gameId, this.confirmedBlockValue);
  }

  private async rebuildOverlay(): Promise<void> {
    const block = await this.input.rpc.getBlockWithReceipts("pre_confirmed");
    this.preconfirmedBlockValue = block.block_number;
    block.transactions.forEach(({ receipt, transaction }) => {
      this.recordTransactionSender(receipt.transaction_hash, transaction);
    });
    for (const events of this.worldEventTransactionsFromBlock(block)) {
      const changes = events.flatMap((event) => {
        const change = this.applyOverlayEvent(event);
        return change ? [change] : [];
      });
      this.publishOverlayTransaction({
        block: block.block_number,
        changes,
        transactionHash: normalizeFelt(events[0]!.transaction_hash),
      });
    }
  }

  private applyOverlayEvent(rawEvent: RawWorldEvent): FoldChange | undefined {
    const identity = `${normalizeFelt(rawEvent.transaction_hash)}:${rawEvent.event_index}`;
    if (this.overlayEvents.has(identity)) return undefined;
    this.overlayEvents.add(identity);
    const event = this.input.decodeMonitor.decode(this.input.registry, rawEvent);
    return event ? this.overlayFold.apply(event) : undefined;
  }

  private worldEventTransactionsFromBlock(block: RpcBlockWithReceipts): RawWorldEvent[][] {
    return block.transactions.flatMap(({ receipt }, transactionIndex) => {
      const events = receipt.events.flatMap((event, eventIndex) => {
        if (BigInt(event.from_address) !== BigInt(this.input.registry.worldAddress)) return [];
        return [
          {
            block_number: null,
            data: event.data,
            event_index: eventIndex,
            keys: event.keys,
            transaction_hash: receipt.transaction_hash,
            transaction_index: transactionIndex,
          },
        ];
      });
      return events.length > 0 ? [events] : [];
    });
  }

  private rawSubscribedEvent(event: RpcSubscribedEvent): RawWorldEvent {
    if (BigInt(event.from_address) !== BigInt(this.input.registry.worldAddress)) {
      throw new Error(`Received subscribed event from unexpected address ${event.from_address}`);
    }
    if (!Number.isSafeInteger(event.event_index) || event.event_index < 0) {
      throw new Error(`Subscribed event ${event.transaction_hash} has invalid event_index ${event.event_index}`);
    }
    return {
      block_number: event.block_number,
      data: event.data,
      event_index: event.event_index,
      keys: event.keys,
      transaction_hash: event.transaction_hash,
      transaction_index: event.transaction_index ?? 0,
    };
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

  private flushPreconfirmedTransaction(): void {
    if (this.pendingPreconfirmedFlush) clearImmediate(this.pendingPreconfirmedFlush);
    this.pendingPreconfirmedFlush = undefined;
    const pending = this.pendingPreconfirmed;
    this.pendingPreconfirmed = undefined;
    if (!pending) return;
    this.preconfirmedReceiptEvents.delete(pending.transactionHash);
    this.publishOverlayTransaction({
      block: null,
      changes: pending.changes,
      transactionHash: pending.transactionHash,
    });
  }

  private publishOverlayTransaction(transaction: OverlayTransaction): void {
    if (transaction.changes.length === 0) return;
    this.overlayTransactions.push(transaction);
    this.broadcastChanges(transaction.changes, transaction.block, true, transaction.transactionHash);
  }

  private snapshotOverlay(gameId: string): SnapshotOverlayDiff[] {
    return this.overlayTransactions.flatMap(({ block, changes, transactionHash }) => {
      const grouped = new Map<string, GameChanges>();
      this.groupChanges(grouped, changes);
      const gameChanges = grouped.get(gameId);
      return gameChanges ? [{ block, transaction_hash: transactionHash, ...gameChanges }] : [];
    });
  }

  private acceptPreconfirmedReceipt(transactionHash: string, receipt: RpcReceipt): void {
    if (receipt.finality_status !== "PRE_CONFIRMED") return;
    const eventIndexes = this.worldEventIndexes(receipt);
    if (eventIndexes.size === 0) return;
    if (this.pendingPreconfirmed?.transactionHash === transactionHash) {
      this.pendingPreconfirmed.expectedEventIndexes = eventIndexes;
      this.flushCompletePreconfirmedTransaction();
      return;
    }
    setBoundedTransactionEntry(this.preconfirmedReceiptEvents, transactionHash, eventIndexes);
  }

  private worldEventIndexes(receipt: RpcReceipt): Set<number> {
    const eventIndexes = new Set<number>();
    receipt.events.forEach((event, eventIndex) => {
      if (BigInt(event.from_address) !== BigInt(this.input.registry.worldAddress)) return;
      const modelSelector = event.keys[1];
      if (modelSelector && this.input.registry.bySelector.has(normalizeFelt(modelSelector))) {
        eventIndexes.add(eventIndex);
      }
    });
    return eventIndexes;
  }

  private flushCompletePreconfirmedTransaction(): void {
    const pending = this.pendingPreconfirmed;
    if (!pending?.expectedEventIndexes) return;
    if ([...pending.expectedEventIndexes].some((eventIndex) => !pending.eventIndexes.has(eventIndex))) return;
    this.pendingPreconfirmedFlush ??= setImmediate(() => this.flushPreconfirmedTransaction());
  }

  private recordTransactionSender(
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
}
