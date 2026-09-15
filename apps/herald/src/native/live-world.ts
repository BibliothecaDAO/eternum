import { LiveWorld, setBoundedTransactionEntry, type LiveWorldInput } from "../live-world";
import { normalizeFelt } from "../model-registry";
import type { FoldChange, RpcHead, RpcReceipt, RpcSubscribedEvent, RpcTransaction } from "../types";
import { NativeReceiptRejected, type NativeIngestion } from "./ingestion";

/** Native delivery uses complete receipts; the existing world implementation owns shared publication and recovery. */
export class NativeLiveWorld extends LiveWorld {
  private readonly transactionGames = new Map<string, string[]>();
  private readonly native: NativeIngestion;

  constructor(input: LiveWorldInput & { native: NativeIngestion }) {
    super(input);
    this.native = input.native;
  }

  public override acceptPreconfirmedEvent(_event: RpcSubscribedEvent): void {}

  public override acceptReceipt(receipt: RpcReceipt): void {
    if (this.native.halted) return;
    if (receipt.finality_status === "PRE_CONFIRMED" && !this.applyOverlayReceipt(receipt, null, 0)) return;
    super.acceptReceipt(receipt);
  }

  protected override acceptPreconfirmedReceipt(_hash: string, _receipt: RpcReceipt): void {}

  public override async publishChainClock(): Promise<void> {
    if (!this.native.halted) await super.publishChainClock();
  }

  public override async acceptSubscribedHead(head: RpcHead): Promise<void> {
    await this.reconcileOrHalt(() => super.acceptSubscribedHead(head));
  }

  public override async reconcileAfterSubscribe(): Promise<void> {
    await this.reconcileOrHalt(() => super.reconcileAfterSubscribe());
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

  protected override async applyConfirmedThrough(target: number): Promise<Map<number, FoldChange[]>> {
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

  protected override async rebuildOverlay(): Promise<void> {
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

  protected override recordTransactionSender(
    hash: string,
    transaction: Pick<RpcTransaction, "contract_address" | "sender_address" | "calldata">,
  ): void {
    const identity = normalizeFelt(hash);
    try {
      setBoundedTransactionEntry(this.transactionGames, identity, this.native.transactionGameIds(transaction));
    } catch (error) {
      this.native.rejectRouting(identity, error);
    }
    super.recordTransactionSender(hash, transaction);
  }

  protected override publishTransactionReceipt(
    hash: string,
    _sender: string | null | undefined,
    receipt: RpcReceipt,
  ): void {
    const status = receipt.execution_status === "REVERTED" ? "REVERTED" : receipt.finality_status;
    for (const gameId of this.transactionGames.get(hash) ?? []) {
      if (this.knownGames.has(gameId))
        this.hub.publishTransaction(gameId, {
          block: receipt.block_number ?? null,
          hash,
          revert_reason: receipt.revert_reason,
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
