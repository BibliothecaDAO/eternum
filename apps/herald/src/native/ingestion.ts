import { transactionGameIds } from "./transactions";
import type { MadaraRpc } from "../madara-rpc";
import { normalizeFelt } from "../model-registry";
import type { DecodedWorldEvent, FoldChange, RpcBlockWithReceipts, RpcReceipt, RpcTransaction } from "../types";
import { WorldFold } from "../world-fold";
import { NativeDecoder } from "./decoder";

export class NativeReceiptRejected extends Error {
  constructor(
    readonly block: number | null,
    readonly transactionHash: string,
    cause: unknown,
  ) {
    super(cause instanceof Error ? cause.message : String(cause), { cause });
  }
}

export class NativeIngestion {
  receiptFailures = 0;
  routingFailures = 0;
  halted?: NativeReceiptRejected;
  constructor(readonly decoder: NativeDecoder) {}

  rejectReceipt(receipt: RpcReceipt, block: number | null, cause: unknown, confirmed: boolean) {
    const rejection = new NativeReceiptRejected(block, normalizeFelt(receipt.transaction_hash), cause);
    this.receiptFailures++;
    if (confirmed) this.halted = rejection;
    console.error(
      JSON.stringify({
        event: "herald_native_receipt_rejected",
        block,
        transactionHash: rejection.transactionHash,
        error: rejection.message,
        confirmed,
        foldHalted: confirmed,
      }),
    );
    return rejection;
  }

  rejectRouting(transactionHash: string, cause: unknown) {
    this.routingFailures++;
    console.error(
      JSON.stringify({
        event: "herald_native_transaction_routing_failed",
        transactionHash,
        error: cause instanceof Error ? cause.message : String(cause),
      }),
    );
  }

  transactionGameIds(transaction: Pick<RpcTransaction, "calldata">): string[] {
    return transactionGameIds(this.decoder.manifest, transaction.calldata);
  }

  applyReceipt(fold: WorldFold, receipt: RpcReceipt, blockNumber: number | null, transactionIndex: number) {
    const preview = fold.overlay();
    const events = this.validateReceipt(preview, receipt, blockNumber, transactionIndex);
    return { events, changes: this.commit(fold, events) };
  }

  async replay(input: {
    fold: WorldFold;
    rpc: Pick<MadaraRpc, "getBlockWithReceipts">;
    fromBlock: number;
    toBlock: number;
  }) {
    if (this.halted) throw this.halted;
    const preview = input.fold.overlay();
    const events: DecodedWorldEvent[] = [];
    let pages = 0;
    for (
      let number = Math.max(input.fromBlock, this.decoder.manifest.native.deploymentBlock);
      number <= input.toBlock;
      number++
    ) {
      const block = await input.rpc.getBlockWithReceipts(number);
      if (block.block_number !== number) throw new Error("Native replay block number mismatch");
      pages++;
      block.transactions.forEach(({ receipt }, index) => {
        try {
          events.push(...this.validateReceipt(preview, receipt, number, index));
        } catch (error) {
          throw this.rejectReceipt(receipt, number, error, true);
        }
      });
    }
    const changes = this.commit(input.fold, events);
    const byBlock = new Map<number, FoldChange[]>();
    changes.forEach(({ event, change }) => {
      if (!change) return;
      const block = event.position.blockNumber!;
      const batch = byBlock.get(block) ?? [];
      batch.push(change);
      byBlock.set(block, batch);
    });
    return {
      events,
      changes: byBlock,
      metrics: {
        decoded_events: events.length,
        event_messages: events.filter((event) => event.kind === "event").length,
        store_events: events.filter((event) => event.kind !== "event").length,
        pages,
      },
    };
  }

  receipts(block: RpcBlockWithReceipts) {
    return block.transactions.flatMap(({ receipt }, transactionIndex) =>
      receipt.events.some((event) => this.decoder.owns(event.from_address)) ? [{ receipt, transactionIndex }] : [],
    );
  }

  private validateReceipt(
    fold: WorldFold,
    receipt: RpcReceipt,
    blockNumber: number | null,
    transactionIndex: number,
  ): DecodedWorldEvent[] {
    if (receipt.execution_status === "REVERTED") return [];
    const decoded: DecodedWorldEvent[] = [];
    receipt.events.forEach((raw, eventIndex) => {
      if (!this.decoder.owns(raw.from_address)) return;
      const event = this.decoder.decode(
        {
          ...raw,
          block_number: blockNumber,
          transaction_hash: normalizeFelt(receipt.transaction_hash),
          transaction_index: transactionIndex,
          event_index: eventIndex,
        },
        fold,
      );
      fold.apply(event);
      decoded.push(event);
    });
    return decoded;
  }
  private commit(fold: WorldFold, events: DecodedWorldEvent[]) {
    return events.flatMap((event) => {
      const derived: FoldChange[] = [];
      const change = fold.apply(event, (row) => derived.push(row));
      return [{ event, change }, ...derived.map((change) => ({ event, change }))];
    });
  }
}
