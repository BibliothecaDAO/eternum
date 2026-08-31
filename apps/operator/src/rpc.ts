import type { ChainEvent, EventSource } from "./types";

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

export class StarknetRpc implements EventSource {
  private requestId = 0;

  public constructor(private readonly url: string) {}

  public blockNumber(): Promise<number> {
    return this.request<number>("starknet_blockNumber", []);
  }

  public chainId(): Promise<string> {
    return this.request<string>("starknet_chainId", []);
  }

  public async getEvents(input: {
    address: string;
    fromBlock: number;
    keys: string[][];
    toBlock: number;
  }): Promise<ChainEvent[]> {
    const events: ChainEvent[] = [];
    const seenTokens = new Set<string>();
    let continuationToken: string | undefined;

    do {
      const response = await this.request<unknown>("starknet_getEvents", [
        {
          address: input.address,
          chunk_size: 1_000,
          continuation_token: continuationToken,
          from_block: { block_number: input.fromBlock },
          keys: input.keys,
          to_block: { block_number: input.toBlock },
        },
      ]);
      const page = parseEventsPage(response);
      events.push(...page.events);
      continuationToken = page.continuation_token;
      if (continuationToken && seenTokens.has(continuationToken)) {
        throw new Error(`RPC repeated getEvents continuation token ${continuationToken}`);
      }
      if (continuationToken) seenTokens.add(continuationToken);
    } while (continuationToken);

    return events.toSorted(compareEventPosition);
  }

  private async request<Result>(method: string, params: unknown[]): Promise<Result> {
    const id = ++this.requestId;
    const response = await fetch(this.url, {
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`);

    const payload = (await response.json()) as JsonRpcSuccess<Result> | JsonRpcFailure;
    if ("error" in payload) {
      const data = payload.error.data === undefined ? "" : `: ${JSON.stringify(payload.error.data)}`;
      throw new Error(`${method} failed (${payload.error.code}): ${payload.error.message}${data}`);
    }
    return payload.result;
  }
}

function parseEventsPage(value: unknown): { continuation_token?: string; events: ChainEvent[] } {
  if (!isRecord(value) || !Array.isArray(value.events)) throw new Error("Malformed starknet_getEvents response");
  const continuationToken = value.continuation_token;
  if (continuationToken !== undefined && typeof continuationToken !== "string") {
    throw new Error("Malformed starknet_getEvents continuation token");
  }
  const events = value.events.map(assertChainEventShape);
  return continuationToken === undefined ? { events } : { continuation_token: continuationToken, events };
}

export function assertChainEventShape(value: unknown, index = 0): ChainEvent {
  if (!isRecord(value)) throw eventShapeError(index, "event is not an object");
  for (const field of ["block_number", "transaction_index", "event_index"] as const) {
    if (!Number.isSafeInteger(value[field]) || Number(value[field]) < 0)
      throw eventShapeError(index, `${field} missing`);
  }
  for (const field of ["transaction_hash", "from_address"] as const) {
    if (typeof value[field] !== "string" || !isFelt(value[field])) throw eventShapeError(index, `${field} invalid`);
  }
  for (const field of ["keys", "data"] as const) {
    if (!Array.isArray(value[field]) || !value[field].every((item) => typeof item === "string" && isFelt(item))) {
      throw eventShapeError(index, `${field} invalid`);
    }
  }
  return value as unknown as ChainEvent;
}

function eventShapeError(index: number, detail: string): Error {
  return new Error(
    `starknet_getEvents event ${index} lacks the RPC v0.10 event shape (${detail}); transaction_index and event_index are required`,
  );
}

function isFelt(value: string): boolean {
  try {
    BigInt(value);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const compareEventPosition = (left: ChainEvent, right: ChainEvent): number =>
  left.block_number - right.block_number ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;
