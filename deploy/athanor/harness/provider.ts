import { BlockTag, config, RpcProvider } from "starknet";

/** The public proxy serves POST RPC; transaction observations poll without opening a node socket. */
export class HarnessProvider extends RpcProvider {
  private readonly subscriptions = new Set<() => void>();
  constructor(rpcUrl: string) {
    super({ blockIdentifier: BlockTag.PRE_CONFIRMED, nodeUrl: rpcUrl });
  }
  async subscribeTransactionStatus(transactionHash: string) {
    type Status = Awaited<ReturnType<RpcProvider["getTransactionStatus"]>>;
    const listeners = new Set<(event: { status: Status }) => void>();
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      this.subscriptions.delete(stop);
    };
    const poll = async () => {
      try {
        const status = await this.getTransactionStatus(transactionHash);
        if (!stopped) listeners.forEach((listener) => listener({ status }));
      } catch {
        /* A hash may not yet be visible, or the proxy may be briefly unavailable. */
      }
      if (!stopped) timer = setTimeout(poll, 250);
    };
    this.subscriptions.add(stop);
    return {
      on: (listener: (event: { status: Status }) => void) => {
        listeners.add(listener);
        if (listeners.size === 1) void poll();
      },
      unsubscribe: async () => {
        stop();
        listeners.clear();
      },
    };
  }
  dispose(): void {
    this.subscriptions.forEach((stop) => stop());
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
