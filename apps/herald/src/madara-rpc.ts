import { hash, num, type BigNumberish } from "starknet";
import type { RpcBlockWithReceipts, RpcHead, RpcEvent, RpcTransaction, RpcReceipt } from "./types";
import { normalizeFelt } from "./model-registry";
import { transactionScopes } from "./native/transactions";
import { setTimeout as delay } from "node:timers/promises";

const EVENT_CHUNK_SIZE = 128;
const TRANSACTION_READ_CONCURRENCY = 16;
const RETRY_MS = 200;
interface BlockHeader extends RpcHead {
  block_hash?: string;
  parent_hash?: string;
  status?: string;
  transactions: string[];
}
interface PagedEvent extends RpcEvent {
  block_number: number | null;
  transaction_hash: string;
  transaction_index: number;
  event_index: number;
}
interface EventPage {
  events: PagedEvent[];
  continuation_token?: string;
}
interface TransactionStatus {
  finality_status: string;
  execution_status?: string;
  failure_reason?: string;
}

interface JsonRpcSuccess<Result> {
  jsonrpc: "2.0";
  id: number;
  result: Result;
}

interface JsonRpcFailure {
  jsonrpc: "2.0";
  id: number;
  error: { code: number; message: string; data?: unknown };
}

export class MadaraRpc {
  private requestId = 0;
  private readonly stopped = new AbortController();

  constructor(private readonly url: string) {}

  public chainId(): Promise<string> {
    return this.request<string>("starknet_chainId", []);
  }

  public blockNumber(): Promise<number> {
    return this.retryBlockRead("latest", async () => {
      const number = await this.request<number>("starknet_blockNumber", []);
      if (!Number.isSafeInteger(number) || number < 0) throw new Error("Invalid block number");
      return number;
    });
  }

  public close(): void {
    this.stopped.abort();
  }

  /** Clock-only consumers do not read events or transactions. */
  public getBlockHeader(block: number | "pre_confirmed"): Promise<RpcHead> {
    return this.retryBlockRead(block, async () => {
      const { block_number, timestamp } = await this.readHeader(block);
      return { block_number, timestamp };
    });
  }

  public getPreconfirmedHeader(): Promise<RpcHead> {
    return this.getBlockHeader("pre_confirmed");
  }

  /** All pages and required transaction metadata finish before this block can enter a fold. */
  public readBlock(block: number | "pre_confirmed", emitter: string): Promise<RpcBlockWithReceipts> {
    return this.retryBlockRead(block, async () => {
      const header = await this.readHeader(block);
      const events = await this.readEvents(header, emitter);
      const transactions = await this.readTransactions(header, events, emitter, block === "pre_confirmed");
      await this.verifyHeader(header, block);
      return { block_number: header.block_number, timestamp: header.timestamp, transactions };
    });
  }

  private async retryBlockRead<Result>(
    block: number | "pre_confirmed" | "latest",
    read: () => Promise<Result>,
  ): Promise<Result> {
    for (;;) {
      this.stopped.signal.throwIfAborted();
      try {
        return await read();
      } catch {
        this.stopped.signal.throwIfAborted();
        console.warn(JSON.stringify({ event: "herald_block_read_retry", block, delayMs: RETRY_MS }));
        await delay(RETRY_MS, undefined, { signal: this.stopped.signal });
      }
    }
  }

  private async readHeader(block: number | "pre_confirmed"): Promise<BlockHeader> {
    const header = await this.request<BlockHeader>("starknet_getBlockWithTxHashes", [
      typeof block === "number" ? { block_number: block } : block,
    ]);
    if (
      !Number.isSafeInteger(header.block_number) ||
      header.block_number < 0 ||
      !Number.isSafeInteger(header.timestamp) ||
      header.timestamp < 0 ||
      !Array.isArray(header.transactions) ||
      header.transactions.some((hash) => typeof hash !== "string") ||
      (typeof block === "number" && header.block_number !== block)
    )
      throw new Error("Invalid block header");
    return header;
  }

  private async readEvents(header: BlockHeader, emitter: string): Promise<Map<number, RpcEvent[]>> {
    const events = new Map<number, RpcEvent[]>();
    const bound = header.block_hash ? { block_hash: header.block_hash } : { block_number: header.block_number };
    const tokens = new Set<string>();
    let continuation: string | undefined;
    let previousTransaction = -1,
      previousEvent = -1;
    do {
      const page = await this.request<EventPage>("starknet_getEvents", [
        {
          from_block: bound,
          to_block: bound,
          address: emitter,
          chunk_size: EVENT_CHUNK_SIZE,
          ...(continuation ? { continuation_token: continuation } : {}),
        },
      ]);
      if (!Array.isArray(page.events) || page.events.length > EVENT_CHUNK_SIZE) throw new Error("Invalid event page");
      for (const event of page.events) {
        if (
          event.block_number !== header.block_number ||
          normalizeFelt(event.from_address) !== normalizeFelt(emitter) ||
          !Number.isSafeInteger(event.transaction_index) ||
          event.transaction_index < 0 ||
          !Number.isSafeInteger(event.event_index) ||
          event.event_index < 0 ||
          event.transaction_index < previousTransaction ||
          (event.transaction_index === previousTransaction && event.event_index <= previousEvent)
        )
          throw new Error("Invalid paged event position");
        previousTransaction = event.transaction_index;
        previousEvent = event.event_index;
        // The captured pre-confirmed prefix can grow while paging; later transactions belong to the next read.
        if (event.transaction_index >= header.transactions.length) {
          if (header.block_hash) throw new Error("Event outside confirmed block");
          continue;
        }
        if (normalizeFelt(event.transaction_hash) !== normalizeFelt(header.transactions[event.transaction_index]!))
          throw new Error("Event transaction differs from header");
        const group = events.get(event.transaction_index) ?? [];
        group.push({
          from_address: event.from_address,
          keys: event.keys,
          data: event.data,
          event_index: event.event_index,
        });
        events.set(event.transaction_index, group);
      }
      continuation = page.continuation_token;
      if (
        continuation !== undefined &&
        (typeof continuation !== "string" || !continuation.length || tokens.has(continuation))
      )
        throw new Error("Invalid event continuation token");
      if (continuation) tokens.add(continuation);
    } while (continuation);
    return events;
  }

  private async readTransactions(
    header: BlockHeader,
    events: Map<number, RpcEvent[]>,
    emitter: string,
    preconfirmed: boolean,
  ): Promise<RpcBlockWithReceipts["transactions"]> {
    const transactions: RpcBlockWithReceipts["transactions"] = [];
    const finality = preconfirmed ? "PRE_CONFIRMED" : header.status;
    if (!finality || !["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(finality))
      throw new Error("Invalid block finality");
    for (let first = 0; first < header.transactions.length; first += TRANSACTION_READ_CONCURRENCY) {
      const batch = await Promise.allSettled(
        header.transactions
          .slice(first, first + TRANSACTION_READ_CONCURRENCY)
          .map((hash, offset) =>
            this.readTransaction(hash, header.block_number, finality, events.get(first + offset) ?? [], emitter),
          ),
      );
      // Wait for the entire bounded batch even after a failure; retries must not overlap its remaining reads.
      for (const item of batch) {
        if (item.status === "rejected") throw item.reason;
        transactions.push(item.value);
      }
    }
    return transactions;
  }

  private async readTransaction(hash: string, block: number, finality: string, events: RpcEvent[], emitter: string) {
    const value = await this.request<RpcTransaction>("starknet_getTransactionByHash", [hash]);
    if (!value.transaction_hash || normalizeFelt(value.transaction_hash) !== normalizeFelt(hash))
      throw new Error("Transaction differs from header");
    const transaction = {
      type: value.type,
      transaction_hash: hash,
      sender_address: value.sender_address,
      contract_address: value.contract_address,
      calldata: value.calldata,
    };
    const receipt: RpcReceipt = { block_number: block, transaction_hash: hash, finality_status: finality, events };
    // Events need execution validation; eventless plays need a negative outcome and routing after reconnect.
    let isPlay = false;
    try {
      isPlay = transactionScopes({ world: { address: emitter } }, transaction).length !== 0;
    } catch {
      /* Routing corruption is reported by ingestion, as for subscribed transactions. */
    }
    if (events.length || isPlay) {
      const status = await this.request<TransactionStatus>("starknet_getTransactionStatus", [hash]);
      if (
        !["SUCCEEDED", "REVERTED"].includes(status.execution_status ?? "") ||
        !["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status)
      )
        throw new Error("Transaction is not executed");
      receipt.execution_status = status.execution_status;
      if (status.failure_reason !== undefined) receipt.revert_reason = status.failure_reason;
    }
    return { transaction, receipt };
  }

  private async verifyHeader(header: BlockHeader, requested: number | "pre_confirmed") {
    let end = await this.readHeader(requested);
    if (end.block_number !== header.block_number) end = await this.readHeader(header.block_number);
    if (
      end.timestamp !== header.timestamp ||
      (header.block_hash && end.block_hash !== header.block_hash) ||
      (header.parent_hash && end.parent_hash !== header.parent_hash) ||
      end.transactions.length < header.transactions.length ||
      header.transactions.some((hash, index) => normalizeFelt(hash) !== normalizeFelt(end.transactions[index]!))
    )
      throw new Error("Block changed while paging");
  }

  /** A read-only contract call at a confirmed block, returning its serialized result. */
  public call(contractAddress: string, entrypoint: string, calldata: BigNumberish[], block: number): Promise<string[]> {
    return this.request<string[]>("starknet_call", [
      {
        contract_address: contractAddress,
        entry_point_selector: hash.getSelectorFromName(entrypoint),
        calldata: calldata.map((value) => num.toHex(value)),
      },
      { block_number: block },
    ]);
  }

  private async request<Result>(method: string, params: unknown[]): Promise<Result> {
    const id = ++this.requestId;
    const response = await fetch(this.url, {
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.any([this.stopped.signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new Error(`Madara ${method} returned HTTP ${response.status}`);

    const payload = (await response.json()) as JsonRpcSuccess<Result> | JsonRpcFailure;
    if (!payload || payload.jsonrpc !== "2.0" || payload.id !== id) throw new Error("Invalid Madara reply");
    if ("error" in payload) {
      const data = payload.error.data === undefined ? "" : `: ${JSON.stringify(payload.error.data)}`;
      throw new Error(`Madara ${method} failed (${payload.error.code}): ${payload.error.message}${data}`);
    }
    if (!Object.hasOwn(payload, "result")) throw new Error("Missing Madara result");
    return payload.result;
  }
}
