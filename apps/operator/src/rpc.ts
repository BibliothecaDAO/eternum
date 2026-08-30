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

interface EventsPage {
  events: ChainEvent[];
  continuation_token?: string;
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
      const page = await this.request<EventsPage>("starknet_getEvents", [
        {
          address: input.address,
          chunk_size: 1_000,
          continuation_token: continuationToken,
          from_block: { block_number: input.fromBlock },
          keys: input.keys,
          to_block: { block_number: input.toBlock },
        },
      ]);
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

const compareEventPosition = (left: ChainEvent, right: ChainEvent): number =>
  left.block_number - right.block_number ||
  left.transaction_index - right.transaction_index ||
  left.event_index - right.event_index;
