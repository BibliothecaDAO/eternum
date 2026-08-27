import type { Felt, RawWorldEvent } from "./types";

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

interface EventPage {
  events: RawWorldEvent[];
  continuation_token?: string;
}

interface GetEventsInput {
  worldAddress: Felt;
  eventSelectors: readonly Felt[];
  modelSelectors: readonly Felt[];
  fromBlock: number;
  toBlock: number;
  chunkSize?: number;
}

export interface EventPageResult {
  events: RawWorldEvent[];
  page: number;
}

export class MadaraRpc {
  private requestId = 0;

  constructor(private readonly url: string) {}

  public blockNumber(): Promise<number> {
    return this.request<number>("starknet_blockNumber", []);
  }

  public async *getEvents(input: GetEventsInput): AsyncGenerator<EventPageResult> {
    const seenTokens = new Set<string>();
    let continuationToken: string | undefined;
    let page = 0;

    do {
      const result = await this.request<EventPage>("starknet_getEvents", [
        {
          address: input.worldAddress,
          chunk_size: input.chunkSize ?? 1_000,
          continuation_token: continuationToken,
          from_block: { block_number: input.fromBlock },
          keys: [input.eventSelectors, input.modelSelectors],
          to_block: { block_number: input.toBlock },
        },
      ]);
      page += 1;
      yield { events: result.events, page };

      continuationToken = result.continuation_token;
      if (continuationToken && seenTokens.has(continuationToken)) {
        throw new Error(`Madara repeated getEvents continuation token ${continuationToken}`);
      }
      if (continuationToken) seenTokens.add(continuationToken);
    } while (continuationToken);
  }

  private async request<Result>(method: string, params: unknown[]): Promise<Result> {
    const id = ++this.requestId;
    const response = await fetch(this.url, {
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!response.ok) throw new Error(`Madara ${method} returned HTTP ${response.status}`);

    const payload = (await response.json()) as JsonRpcSuccess<Result> | JsonRpcFailure;
    if ("error" in payload) {
      const data = payload.error.data === undefined ? "" : `: ${JSON.stringify(payload.error.data)}`;
      throw new Error(`Madara ${method} failed (${payload.error.code}): ${payload.error.message}${data}`);
    }
    return payload.result;
  }
}
