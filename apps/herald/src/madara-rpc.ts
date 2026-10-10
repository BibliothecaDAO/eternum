import { hash, num, type BigNumberish } from "starknet";
import type { RpcBlockWithReceipts, RpcHead, RpcEvent, RpcTransaction, RpcReceipt } from "./types";
import { normalizeFelt } from "./model-registry";
import { transactionScopes } from "./native/transactions";
import { setTimeout as delay } from "node:timers/promises";

const EVENT_CHUNK_SIZE = 1000;
const TRANSACTION_READ_CONCURRENCY = 16;
const REQUEST_ATTEMPTS = 3;
const BLOCK_ATTEMPTS = 3;
const BACKOFF_MS = 100;

class RpcReadFailure extends Error {
  constructor(
    readonly method: string,
    readonly code: number | string,
  ) {
    super(`Madara read failed: ${method} (${code})`);
  }
}
class BlockConsistencyFailure extends RpcReadFailure {}

export interface ReadBlockOptions {
  retainTransactions?: boolean;
  knownTransaction?: (hash: string) => RpcTransaction | undefined;
  needsCalldata?: (events: readonly RpcEvent[]) => boolean;
}
interface BlockHeader extends RpcHead {
  block_hash?: string;
  parent_hash?: string;
  status?: string;
  transactions: string[];
}
interface PagedEvent extends RpcEvent {
  block_number?: number | null;
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
      if (!Number.isSafeInteger(number) || number < 0)
        throw new BlockConsistencyFailure("starknet_blockNumber", "invalid_number");
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
  public readBlock(
    block: number | "pre_confirmed",
    emitter: string,
    options: ReadBlockOptions = {},
  ): Promise<RpcBlockWithReceipts> {
    return this.retryBlockRead(block, async () => {
      const header = await this.readHeader(block);
      const events = await this.readEvents(header, emitter, block === "pre_confirmed");
      const transactions = await this.readTransactions(header, events, emitter, block === "pre_confirmed", options);
      await this.verifyHeader(header, block);
      return { block_number: header.block_number, timestamp: header.timestamp, transactions };
    });
  }

  private async retryBlockRead<Result>(
    block: number | "pre_confirmed" | "latest",
    read: () => Promise<Result>,
  ): Promise<Result> {
    for (let attempt = 1; attempt <= BLOCK_ATTEMPTS; attempt++) {
      this.stopped.signal.throwIfAborted();
      try {
        return await read();
      } catch (error) {
        this.stopped.signal.throwIfAborted();
        const failure =
          error instanceof RpcReadFailure ? error : new BlockConsistencyFailure("block", "invalid_content");
        if (!(failure instanceof BlockConsistencyFailure) || attempt === BLOCK_ATTEMPTS) {
          console.error(
            JSON.stringify({ event: "herald_block_read_halted", block, method: failure.method, code: failure.code }),
          );
          throw failure;
        }
        console.warn(
          JSON.stringify({
            event: "herald_block_consistency_retry",
            block,
            method: failure.method,
            code: failure.code,
            attempt,
          }),
        );
        await delay(BACKOFF_MS * 2 ** (attempt - 1), undefined, { signal: this.stopped.signal });
      }
    }
    throw new Error("Block attempts exhausted");
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
      throw new BlockConsistencyFailure("starknet_getBlockWithTxHashes", "invalid_header");
    return header;
  }

  private async readEvents(
    header: BlockHeader,
    emitter: string,
    preconfirmed: boolean,
  ): Promise<Map<number, RpcEvent[]>> {
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
      if (!Array.isArray(page.events) || page.events.length > EVENT_CHUNK_SIZE)
        throw new BlockConsistencyFailure("starknet_getEvents", "invalid_page");
      for (const event of page.events) {
        if (
          (event.block_number == null && !preconfirmed) ||
          (event.block_number != null && event.block_number !== header.block_number) ||
          normalizeFelt(event.from_address) !== normalizeFelt(emitter) ||
          !Number.isSafeInteger(event.transaction_index) ||
          event.transaction_index < 0 ||
          !Number.isSafeInteger(event.event_index) ||
          event.event_index < 0 ||
          event.transaction_index < previousTransaction ||
          (event.transaction_index === previousTransaction && event.event_index <= previousEvent)
        )
          throw new BlockConsistencyFailure("starknet_getEvents", "invalid_position");
        previousTransaction = event.transaction_index;
        previousEvent = event.event_index;
        // The captured pre-confirmed prefix can grow while paging; later transactions belong to the next read.
        if (event.transaction_index >= header.transactions.length) {
          if (!preconfirmed) throw new BlockConsistencyFailure("starknet_getEvents", "outside_block");
          continue;
        }
        if (normalizeFelt(event.transaction_hash) !== normalizeFelt(header.transactions[event.transaction_index]!))
          throw new BlockConsistencyFailure("starknet_getEvents", "transaction_mismatch");
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
        throw new BlockConsistencyFailure("starknet_getEvents", "invalid_token");
      if (continuation) tokens.add(continuation);
    } while (continuation);
    return events;
  }

  private async readTransactions(
    header: BlockHeader,
    events: Map<number, RpcEvent[]>,
    emitter: string,
    preconfirmed: boolean,
    options: ReadBlockOptions,
  ): Promise<RpcBlockWithReceipts["transactions"]> {
    const transactions: RpcBlockWithReceipts["transactions"] = [];
    const finality = preconfirmed ? "PRE_CONFIRMED" : header.status;
    if (!finality || !["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(finality))
      throw new BlockConsistencyFailure("starknet_getBlockWithTxHashes", "invalid_finality");
    for (let first = 0; first < header.transactions.length; first += TRANSACTION_READ_CONCURRENCY) {
      const batch = await Promise.allSettled(
        header.transactions
          .slice(first, first + TRANSACTION_READ_CONCURRENCY)
          .map((hash, offset) =>
            this.readTransaction(
              hash,
              header.block_number,
              finality,
              events.get(first + offset) ?? [],
              emitter,
              options,
            ),
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

  private async readTransaction(
    hash: string,
    block: number,
    finality: string,
    events: RpcEvent[],
    emitter: string,
    options: ReadBlockOptions,
  ) {
    let transaction = options.knownTransaction?.(normalizeFelt(hash));
    const needsCalldata = options.needsCalldata?.(events) === true;
    if ((!transaction && options.retainTransactions !== false) || (needsCalldata && !transaction?.calldata)) {
      const value = await this.request<RpcTransaction>("starknet_getTransactionByHash", [hash]);
      if (!value.transaction_hash || normalizeFelt(value.transaction_hash) !== normalizeFelt(hash))
        throw new BlockConsistencyFailure("starknet_getTransactionByHash", "hash_mismatch");
      transaction = {
        type: value.type,
        transaction_hash: hash,
        sender_address: value.sender_address,
        contract_address: value.contract_address,
        calldata: value.calldata,
      };
    }
    transaction ??= { type: "UNKNOWN", transaction_hash: hash };
    const receipt: RpcReceipt = { block_number: block, transaction_hash: hash, finality_status: finality, events };
    if (events.length) receipt.execution_status = "SUCCEEDED";
    else if (options.retainTransactions !== false) {
      let isPlay = false;
      try {
        isPlay = transactionScopes({ world: { address: emitter } }, transaction).length !== 0;
      } catch {
        /* The existing ingestion routing guard reports malformed account calls. */
      }
      if (isPlay) {
        const status = await this.request<TransactionStatus>("starknet_getTransactionStatus", [hash]);
        if (
          !["SUCCEEDED", "REVERTED"].includes(status.execution_status ?? "") ||
          !["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(status.finality_status)
        )
          throw new BlockConsistencyFailure("starknet_getTransactionStatus", "not_executed");
        receipt.execution_status = status.execution_status;
        if (status.failure_reason !== undefined) receipt.revert_reason = status.failure_reason;
      }
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
      throw new BlockConsistencyFailure("starknet_getBlockWithTxHashes", "changed_header");
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
    for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt++) {
      this.stopped.signal.throwIfAborted();
      try {
        return await this.requestOnce<Result>(method, params);
      } catch (error) {
        this.stopped.signal.throwIfAborted();
        const failure =
          error instanceof RpcReadFailure
            ? error
            : new RpcReadFailure(
                method,
                error instanceof Error && error.name === "TimeoutError" ? "timeout" : "transport",
              );
        console.warn(JSON.stringify({ event: "herald_rpc_read_failed", method, code: failure.code, attempt }));
        if (attempt === REQUEST_ATTEMPTS) throw failure;
        await delay(BACKOFF_MS * 2 ** (attempt - 1), undefined, { signal: this.stopped.signal });
      }
    }
    throw new Error("Request attempts exhausted");
  }

  private async requestOnce<Result>(method: string, params: unknown[]): Promise<Result> {
    const id = ++this.requestId;
    const response = await fetch(this.url, {
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.any([this.stopped.signal, AbortSignal.timeout(5000)]),
    });
    if (!response.ok) throw new RpcReadFailure(method, `http_${response.status}`);
    const payload = (await response.json()) as JsonRpcSuccess<Result> | JsonRpcFailure;
    if (!payload || payload.jsonrpc !== "2.0" || payload.id !== id) throw new RpcReadFailure(method, "invalid_reply");
    if ("error" in payload)
      throw new RpcReadFailure(
        method,
        typeof payload.error.code === "number" && Number.isInteger(payload.error.code)
          ? payload.error.code
          : "invalid_error",
      );
    if (!Object.hasOwn(payload, "result")) throw new RpcReadFailure(method, "missing_result");
    return payload.result;
  }
}
