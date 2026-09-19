import { BlockTag, config, RpcProvider, WebSocketChannel } from "starknet";

/** One socket per run; the SDK restores subscriptions and the node sends their current canonical status. */
export class HarnessProvider extends RpcProvider {
  private observations?: { channel: WebSocketChannel; ready: Promise<unknown> };

  constructor(private readonly rpcUrl: string) {
    super({ blockIdentifier: BlockTag.PRE_CONFIRMED, nodeUrl: rpcUrl });
  }

  async subscribeTransactionStatus(transactionHash: string) {
    if (!this.observations) {
      const channel = new WebSocketChannel({ nodeUrl: this.rpcUrl.replace(/^http/, "ws"), autoReconnect: true });
      this.observations = { channel, ready: channel.waitForConnection() };
    }
    await this.observations.ready;
    return this.observations.channel.subscribeTransactionStatus({ transactionHash });
  }

  dispose(): void {
    this.observations?.channel.disconnect();
  }
}

export interface HarnessRpcRequests {
  http: Record<string, number>;
  websocket: Record<string, number>;
}

/** SDK transport hooks count actual requests, including reconnects, in this game's worker. */
export function measureHarnessRequests(rpcUrl: string) {
  const host = new URL(rpcUrl).host;
  const previousFetch = config.get("fetch");
  const previousSocket = config.get("websocket");
  const baseFetch: typeof fetch = previousFetch ?? globalThis.fetch;
  const BaseSocket: typeof WebSocket = previousSocket ?? globalThis.WebSocket;
  let enabled = false;
  let requests: HarnessRpcRequests = { http: {}, websocket: {} };
  const record = (url: string, data: unknown, transport: keyof HarnessRpcRequests) => {
    if (!enabled || new URL(url).host !== host || typeof data !== "string") return;
    try {
      const payload = JSON.parse(data);
      for (const request of Array.isArray(payload) ? payload : [payload]) {
        if (typeof request.method === "string")
          requests[transport][request.method] = (requests[transport][request.method] ?? 0) + 1;
      }
    } catch {
      /* Non-RPC traffic does not contribute to the request count. */
    }
  };
  config.set("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    record(input instanceof Request ? input.url : String(input), init?.body, "http");
    return baseFetch(input, init);
  });
  config.set(
    "websocket",
    class extends BaseSocket {
      send(data: Parameters<WebSocket["send"]>[0]) {
        record(this.url, data, "websocket");
        return super.send(data);
      }
    },
  );
  return {
    start() {
      requests = { http: {}, websocket: {} };
      enabled = true;
    },
    finish(): HarnessRpcRequests {
      enabled = false;
      return requests;
    },
    dispose() {
      config.set("fetch", previousFetch);
      config.set("websocket", previousSocket);
    },
  };
}
