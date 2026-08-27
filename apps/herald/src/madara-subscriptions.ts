import type { ModelRegistry } from "./model-registry";
import type { RpcHead, RpcReceipt, RpcSubscribedEvent } from "./types";
import { WORLD_EVENT_SELECTORS } from "./world-event-decoder";

interface SubscriptionHandlers {
  onEvent: (event: RpcSubscribedEvent) => Promise<void> | void;
  onFatal: (error: Error) => void;
  onHead: (head: RpcHead) => Promise<void> | void;
  onReady: () => Promise<void> | void;
  onReceipt: (receipt: RpcReceipt) => Promise<void> | void;
}

interface JsonRpcMessage {
  id?: number;
  error?: { code: number; message: string; data?: unknown };
  method?: string;
  params?: { result?: unknown };
  result?: unknown;
}

const SUBSCRIPTION_COUNT = 3;
const RECONNECT_MS = 200;

export class MadaraSubscriptions {
  private closed = false;
  private generation = 0;
  private initialReady = false;
  private queue = Promise.resolve();
  private readyPromise?: Promise<void>;
  private resolveReady?: () => void;
  private rejectReady?: (error: Error) => void;
  private socket?: WebSocket;

  constructor(
    private readonly url: string,
    private readonly registry: ModelRegistry,
    private readonly handlers: SubscriptionHandlers,
  ) {}

  public start(): Promise<void> {
    this.readyPromise ??= new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.connect();
    return this.readyPromise;
  }

  public stop(): void {
    this.closed = true;
    this.socket?.close();
  }

  private connect(): void {
    const socket = new WebSocket(this.url);
    const generation = ++this.generation;
    const pendingNotifications: JsonRpcMessage[] = [];
    const ready = new Set<number>();
    let subscriptionsReady = false;
    this.socket = socket;

    socket.onopen = () => this.subscribe(socket);
    socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(String(message.data)) as JsonRpcMessage;
        if (payload.id !== undefined) {
          this.acceptSubscription(payload, ready);
          if (ready.size === SUBSCRIPTION_COUNT && !subscriptionsReady) {
            subscriptionsReady = true;
            this.enqueue(async () => {
              await this.handlers.onReady();
              if (!this.initialReady) {
                this.initialReady = true;
                this.resolveReady?.();
              }
            });
            pendingNotifications.forEach((notification) => this.acceptNotification(notification));
            pendingNotifications.length = 0;
          }
          return;
        }
        if (!subscriptionsReady) {
          pendingNotifications.push(payload);
          return;
        }
        this.acceptNotification(payload);
      } catch (error) {
        this.fail(this.asError(error));
      }
    };
    socket.onerror = () => undefined;
    socket.onclose = () => {
      if (this.closed || generation !== this.generation) return;
      setTimeout(() => this.connect(), RECONNECT_MS);
    };
  }

  private subscribe(socket: WebSocket): void {
    this.send(socket, 1, "starknet_subscribeNewHeads", {});
    this.send(socket, 2, "starknet_subscribeEvents", {
      address: this.registry.worldAddress,
      finality_status: "PRE_CONFIRMED",
      keys: [Object.values(WORLD_EVENT_SELECTORS), [...this.registry.bySelector.keys()]],
    });
    this.send(socket, 3, "starknet_subscribeNewTransactionReceipts", {
      finality_status: ["PRE_CONFIRMED", "ACCEPTED_ON_L2"],
    });
  }

  private acceptSubscription(payload: JsonRpcMessage, ready: Set<number>): void {
    if (payload.error) {
      const data = payload.error.data === undefined ? "" : `: ${JSON.stringify(payload.error.data)}`;
      throw new Error(
        `Madara subscription ${payload.id} failed (${payload.error.code}): ${payload.error.message}${data}`,
      );
    }
    if (typeof payload.result !== "string") throw new Error(`Madara subscription ${payload.id} returned no id`);
    ready.add(payload.id!);
  }

  private acceptNotification(payload: JsonRpcMessage): void {
    const result = payload.params?.result;
    if (!result) throw new Error(`Madara sent ${payload.method ?? "an unnamed notification"} without a result`);
    if (payload.method === "starknet_subscriptionNewHeads") {
      this.enqueue(() => this.handlers.onHead(result as RpcHead));
      return;
    }
    if (payload.method === "starknet_subscriptionEvents") {
      this.enqueue(() => this.handlers.onEvent(result as RpcSubscribedEvent));
      return;
    }
    if (payload.method === "starknet_subscriptionNewTransactionReceipts") {
      this.enqueue(() => this.handlers.onReceipt(result as RpcReceipt));
      return;
    }
    throw new Error(`Unexpected Madara notification ${payload.method}`);
  }

  private enqueue(task: () => Promise<void> | void): void {
    this.queue = this.queue.then(task).catch((error) => this.fail(this.asError(error)));
  }

  private send(socket: WebSocket, id: number, method: string, params: unknown): void {
    socket.send(JSON.stringify({ id, jsonrpc: "2.0", method, params }));
  }

  private asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  private fail(error: Error): void {
    if (!this.initialReady) this.rejectReady?.(error);
    this.handlers.onFatal(error);
  }
}
