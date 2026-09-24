import { nativeExecutionOutcomes } from "@bibliothecadao/provider";
import { transactionScopes } from "./transactions";
import type { MadaraRpc } from "../madara-rpc";
import { normalizeFelt } from "../model-registry";
import type {
  DecodedWorldEvent,
  FoldChange,
  RpcBlockTransaction,
  RpcBlockWithReceipts,
  RpcEvent,
  RpcReceipt,
  RpcTransaction,
} from "../types";
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

/** A receipt's native events as the overlay decoded them while the receipt was pre-confirmed. */
export interface PreconfirmedDecode {
  events: readonly RpcEvent[];
  decoded: readonly DecodedWorldEvent[];
}

const sameFelts = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((felt, index) => felt === right[index]);

const sameEvents = (left: readonly RpcEvent[], right: readonly RpcEvent[]) =>
  left.length === right.length &&
  left.every(
    (event, index) =>
      event.from_address === right[index]!.from_address &&
      sameFelts(event.keys, right[index]!.keys) &&
      sameFelts(event.data, right[index]!.data),
  );

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

  transactionScopes(transaction: Pick<RpcTransaction, "calldata">) {
    return transactionScopes(this.decoder.manifest, transaction.calldata);
  }

  applyReceipt(fold: WorldFold, receipt: RpcReceipt, blockNumber: number | null, transactionIndex: number) {
    const preview = fold.overlay();
    const events = this.validateReceipt(preview, receipt, blockNumber, transactionIndex);
    return { events, changes: this.commit(fold, events) };
  }

  actionReceipt(fold: WorldFold, receipt: RpcReceipt): RpcReceipt {
    this.validateReceipt(fold.overlay(), receipt, receipt.block_number ?? null, 0);
    return this.executionReceipt(receipt);
  }

  /** The receipt with its native execution outcomes, for a receipt already validated. */
  executionReceipt(receipt: RpcReceipt): RpcReceipt {
    if (receipt.execution_status === "REVERTED") return receipt;
    return { ...receipt, executions: nativeExecutionOutcomes(receipt.events, this.decoder.manifest.world.address) };
  }

  async replay(input: {
    fold: WorldFold;
    rpc: Pick<MadaraRpc, "getBlockWithReceipts">;
    fromBlock: number;
    toBlock: number;
    /** The overlay's decode of a receipt it holds, reused when the confirmed receipt repeats its events. */
    preconfirmed?: (receipt: RpcReceipt) => PreconfirmedDecode | undefined;
  }) {
    if (this.halted) throw this.halted;
    const preview = input.fold.overlay();
    const events: DecodedWorldEvent[] = [];
    const transactions: RpcBlockTransaction[] = [];
    let pages = 0;
    for (
      let number = Math.max(input.fromBlock, this.decoder.manifest.native.deploymentBlock);
      number <= input.toBlock;
      number++
    ) {
      const block = await input.rpc.getBlockWithReceipts(number);
      if (block.block_number !== number) throw new Error("Native replay block number mismatch");
      pages++;
      block.transactions.forEach(({ receipt, transaction }, index) => {
        try {
          events.push(...this.validateReceipt(preview, receipt, number, index, input.preconfirmed?.(receipt)));
          transactions.push({
            transaction,
            receipt: this.executionReceipt({ ...receipt, block_number: number }),
          });
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
      transactions,
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
    earlier?: PreconfirmedDecode,
  ): DecodedWorldEvent[] {
    if (receipt.execution_status === "REVERTED") return [];
    const decoded = this.decodeReceipt(receipt, blockNumber, transactionIndex, earlier);
    decoded.forEach((event) => fold.apply(event));
    return decoded;
  }

  /**
   * A receipt's native events. Decoding hashes every row, and a transaction's confirmed receipt repeats its
   * pre-confirmed events, so an earlier decode of the same events is reused at this receipt's position.
   */
  private decodeReceipt(
    receipt: RpcReceipt,
    blockNumber: number | null,
    transactionIndex: number,
    earlier?: PreconfirmedDecode,
  ): DecodedWorldEvent[] {
    if (earlier && sameEvents(earlier.events, receipt.events))
      return earlier.decoded.map((event) => ({
        ...event,
        position: { ...event.position, blockNumber, transactionIndex },
      }));
    return receipt.events.flatMap((raw, eventIndex) =>
      this.decoder.owns(raw.from_address)
        ? [
            this.decoder.decode({
              ...raw,
              block_number: blockNumber,
              transaction_hash: normalizeFelt(receipt.transaction_hash),
              transaction_index: transactionIndex,
              event_index: eventIndex,
            }),
          ]
        : [],
    );
  }
  private commit(fold: WorldFold, events: DecodedWorldEvent[]) {
    return events.flatMap((event) => {
      const derived: FoldChange[] = [];
      const change = fold.apply(event, (row) => derived.push(row));
      return [{ event, change }, ...derived.map((change) => ({ event, change }))];
    });
  }
}
