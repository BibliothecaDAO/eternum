import type { GetTransactionReceiptResponse, TransactionFinalityStatus } from "starknet";
import type { RetryConfig } from "./retry";

export const TX_WAIT_RETRY_INTERVAL_MS = 500;
export const TX_WAIT_SUCCESS_STATES: TransactionFinalityStatus[] = [
  "PRE_CONFIRMED" as TransactionFinalityStatus,
  "ACCEPTED_ON_L2" as TransactionFinalityStatus,
  "ACCEPTED_ON_L1" as TransactionFinalityStatus,
];

export type TransactionConfirmationMode = "auto" | "polling" | "websocket";

export type WebSocketLike = {
  readyState?: number;
  onopen?: (() => void) | null;
  onmessage?: ((event: { data: unknown }) => void) | null;
  onerror?: ((error: unknown) => void) | null;
  onclose?: (() => void) | null;
  addEventListener?: (event: string, listener: (...args: any[]) => void) => void;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  send: (payload: string) => void;
  close: () => void;
};

export type WebSocketFactory = (url: string) => WebSocketLike | Promise<WebSocketLike>;

export interface TransactionConfirmationConfig {
  mode?: TransactionConfirmationMode;
  wsUrl?: string;
  websocketFactory?: WebSocketFactory;
}

export interface EternumProviderOptions {
  retryConfig?: RetryConfig;
  transactionConfirmation?: TransactionConfirmationConfig;
}

export interface TransactionReceiptProvider {
  waitForTransaction(
    transactionHash: string,
    options: {
      retryInterval: number;
      successStates: TransactionFinalityStatus[];
    },
  ): Promise<GetTransactionReceiptResponse>;
  getTransactionReceipt(transactionHash: string): Promise<GetTransactionReceiptResponse>;
}

export interface TransactionReceiptWaiter {
  waitForTransactionReceipt(transactionHash: string): Promise<GetTransactionReceiptResponse>;
}

type JsonRpcMessage = {
  id?: number | string;
  method?: string;
  result?: unknown;
  error?: unknown;
  params?: unknown;
};

type PendingRequest = {
  resolve: (result: unknown) => void;
  reject: (error: unknown) => void;
};

type PendingSubscription = {
  transactionHash: string;
  resolve: () => void;
  reject: (error: unknown) => void;
};

type TransactionStatusNotification = {
  subscriptionId?: string;
  transactionHash?: string;
  finalityStatus?: string;
};

export const createTransactionReceiptWaiter = (
  provider: TransactionReceiptProvider,
  config: TransactionConfirmationConfig = {},
): TransactionReceiptWaiter => {
  const pollingWaiter = new PollingTransactionReceiptWaiter(provider);
  const mode = config.mode ?? "auto";

  if (mode === "polling" || !config.wsUrl) {
    return pollingWaiter;
  }

  const websocketWaiter = new WebSocketTransactionReceiptWaiter(provider, config.wsUrl, config.websocketFactory);
  if (mode === "websocket") {
    return websocketWaiter;
  }

  return new FallbackTransactionReceiptWaiter(websocketWaiter, pollingWaiter);
};

class PollingTransactionReceiptWaiter implements TransactionReceiptWaiter {
  constructor(private readonly provider: TransactionReceiptProvider) {}

  async waitForTransactionReceipt(transactionHash: string): Promise<GetTransactionReceiptResponse> {
    return await this.provider.waitForTransaction(transactionHash, {
      retryInterval: TX_WAIT_RETRY_INTERVAL_MS,
      successStates: TX_WAIT_SUCCESS_STATES,
    });
  }
}

class FallbackTransactionReceiptWaiter implements TransactionReceiptWaiter {
  constructor(
    private readonly preferredWaiter: TransactionReceiptWaiter,
    private readonly fallbackWaiter: TransactionReceiptWaiter,
  ) {}

  async waitForTransactionReceipt(transactionHash: string): Promise<GetTransactionReceiptResponse> {
    try {
      return await this.preferredWaiter.waitForTransactionReceipt(transactionHash);
    } catch {
      return await this.fallbackWaiter.waitForTransactionReceipt(transactionHash);
    }
  }
}

class WebSocketTransactionReceiptWaiter implements TransactionReceiptWaiter {
  private connection?: Promise<WebSocketJsonRpcConnection>;

  constructor(
    private readonly provider: TransactionReceiptProvider,
    private readonly wsUrl: string,
    private readonly websocketFactory?: WebSocketFactory,
  ) {}

  async waitForTransactionReceipt(transactionHash: string): Promise<GetTransactionReceiptResponse> {
    const connection = await this.getConnection();
    const subscriptionId = await connection.subscribeTransactionStatus(transactionHash);

    try {
      await connection.waitForTransactionStatus(subscriptionId, transactionHash);
      return await this.provider.getTransactionReceipt(transactionHash);
    } finally {
      connection.unsubscribe(subscriptionId);
    }
  }

  private async getConnection(): Promise<WebSocketJsonRpcConnection> {
    if (!this.connection) {
      this.connection = WebSocketJsonRpcConnection.open(this.wsUrl, this.websocketFactory).catch((error) => {
        this.connection = undefined;
        throw error;
      });
    }

    return await this.connection;
  }
}

class WebSocketJsonRpcConnection {
  private nextRequestId = 1;
  private pendingRequests = new Map<number, PendingRequest>();
  private pendingSubscriptions = new Map<string, PendingSubscription>();
  private completedSubscriptions = new Map<string, string | undefined>();

  private constructor(private readonly socket: WebSocketLike) {}

  static async open(wsUrl: string, websocketFactory?: WebSocketFactory): Promise<WebSocketJsonRpcConnection> {
    const socket = await createWebSocket(wsUrl, websocketFactory);
    const connection = new WebSocketJsonRpcConnection(socket);
    await connection.waitUntilOpen();
    connection.attachMessageHandlers();
    return connection;
  }

  async subscribeTransactionStatus(transactionHash: string): Promise<string> {
    const result = await this.sendRequest("starknet_subscribeTransactionStatus", [transactionHash]);
    if (typeof result !== "string" || result.length === 0) {
      throw new Error("Starknet websocket subscription did not return a subscription id");
    }

    return result;
  }

  waitForTransactionStatus(subscriptionId: string, transactionHash: string): Promise<void> {
    if (this.matchesCompletedSubscription(subscriptionId, transactionHash)) {
      this.completedSubscriptions.delete(subscriptionId);
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingSubscriptions.set(subscriptionId, {
        transactionHash,
        resolve,
        reject,
      });
    });
  }

  unsubscribe(subscriptionId: string): void {
    this.pendingSubscriptions.delete(subscriptionId);
    void this.sendRequest("starknet_unsubscribe", [subscriptionId]).catch(() => {
      // Nothing actionable remains once local subscription state has been cleared.
    });
  }

  private waitUntilOpen(): Promise<void> {
    if (this.socket.readyState === 1) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
      const handleOpen = () => resolve();
      const handleFailure = (error: unknown) => {
        reject(error instanceof Error ? error : new Error("Websocket failed"));
      };

      attachWebSocketHandler(this.socket, "open", handleOpen);
      attachWebSocketHandler(this.socket, "error", handleFailure);
      attachWebSocketHandler(this.socket, "close", () => handleFailure(new Error("Websocket closed before opening")));
    });
  }

  private attachMessageHandlers(): void {
    attachWebSocketHandler(this.socket, "message", (event: { data: unknown }) => {
      this.handleMessage(event.data);
    });
    attachWebSocketHandler(this.socket, "error", (error: unknown) => {
      this.rejectActiveWork(error);
    });
    attachWebSocketHandler(this.socket, "close", () => {
      this.rejectActiveWork(new Error("Websocket connection closed"));
    });
  }

  private sendRequest(method: string, params: unknown[]): Promise<unknown> {
    const id = this.nextRequestId++;
    const payload = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    return new Promise<unknown>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      try {
        this.socket.send(payload);
      } catch (error) {
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private handleMessage(data: unknown): void {
    const message = parseJsonRpcMessage(data);
    if (!message) {
      return;
    }

    if (message.id !== undefined) {
      this.resolveRequest(message);
      return;
    }

    if (message.method === "starknet_subscriptionTransactionStatus") {
      this.resolveTransactionStatus(message.params);
    }
  }

  private resolveRequest(message: JsonRpcMessage): void {
    const id = Number(message.id);
    const pendingRequest = this.pendingRequests.get(id);
    if (!pendingRequest) {
      return;
    }

    this.pendingRequests.delete(id);
    if (message.error !== undefined) {
      pendingRequest.reject(message.error);
      return;
    }

    pendingRequest.resolve(message.result);
  }

  private resolveTransactionStatus(params: unknown): void {
    const notification = parseTransactionStatusNotification(params);
    if (!notification.subscriptionId || !notification.finalityStatus) {
      return;
    }

    const pendingSubscription = this.pendingSubscriptions.get(notification.subscriptionId);
    if (TX_WAIT_SUCCESS_STATES.includes(notification.finalityStatus as TransactionFinalityStatus)) {
      if (!pendingSubscription) {
        this.completedSubscriptions.set(notification.subscriptionId, notification.transactionHash);
        return;
      }

      if (notification.transactionHash && notification.transactionHash !== pendingSubscription.transactionHash) {
        return;
      }

      pendingSubscription.resolve();
    }
  }

  private matchesCompletedSubscription(subscriptionId: string, transactionHash: string): boolean {
    if (!this.completedSubscriptions.has(subscriptionId)) {
      return false;
    }

    const completedTransactionHash = this.completedSubscriptions.get(subscriptionId);
    return !completedTransactionHash || completedTransactionHash === transactionHash;
  }

  private rejectActiveWork(error: unknown): void {
    for (const pendingRequest of this.pendingRequests.values()) {
      pendingRequest.reject(error);
    }
    this.pendingRequests.clear();

    for (const pendingSubscription of this.pendingSubscriptions.values()) {
      pendingSubscription.reject(error);
    }
    this.pendingSubscriptions.clear();
  }
}

const createWebSocket = async (wsUrl: string, websocketFactory?: WebSocketFactory): Promise<WebSocketLike> => {
  if (websocketFactory) {
    return await websocketFactory(wsUrl);
  }

  if (typeof globalThis.WebSocket === "function") {
    return new globalThis.WebSocket(wsUrl) as WebSocketLike;
  }

  const wsModule = (await import("ws")) as {
    WebSocket?: new (url: string) => WebSocketLike;
    default?: new (url: string) => WebSocketLike;
  };
  const WebSocketConstructor = wsModule.WebSocket ?? wsModule.default;
  if (!WebSocketConstructor) {
    throw new Error("No websocket implementation is available");
  }

  return new WebSocketConstructor(wsUrl);
};

const attachWebSocketHandler = (socket: WebSocketLike, event: string, listener: (...args: any[]) => void): void => {
  if (typeof socket.addEventListener === "function") {
    socket.addEventListener(event, listener);
    return;
  }

  if (typeof socket.on === "function") {
    socket.on(event, listener);
    return;
  }

  if (event === "open") {
    socket.onopen = () => listener();
  }
  if (event === "message") {
    socket.onmessage = (message) => listener(message);
  }
  if (event === "error") {
    socket.onerror = (error) => listener(error);
  }
  if (event === "close") {
    socket.onclose = () => listener();
  }
};

const parseJsonRpcMessage = (data: unknown): JsonRpcMessage | null => {
  try {
    const raw =
      typeof data === "string"
        ? data
        : typeof Buffer !== "undefined" && data instanceof Buffer
          ? data.toString("utf8")
          : String(data);
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as JsonRpcMessage) : null;
  } catch {
    return null;
  }
};

const parseTransactionStatusNotification = (params: unknown): TransactionStatusNotification => {
  if (Array.isArray(params)) {
    return buildTransactionStatusNotification(params[0], params[1]);
  }

  if (!params || typeof params !== "object") {
    return {};
  }

  const record = params as Record<string, unknown>;
  return buildTransactionStatusNotification(record.subscription_id ?? record.subscriptionId, record.result);
};

const buildTransactionStatusNotification = (
  subscriptionId: unknown,
  result: unknown,
): TransactionStatusNotification => {
  if (!result || typeof result !== "object") {
    return {
      subscriptionId: typeof subscriptionId === "string" ? subscriptionId : undefined,
    };
  }

  const record = result as Record<string, unknown>;
  const status = record.status && typeof record.status === "object" ? (record.status as Record<string, unknown>) : {};
  const finalityStatus =
    status.finality_status ?? status.finalityStatus ?? record.finality_status ?? record.finalityStatus;
  const transactionHash = record.transaction_hash ?? record.transactionHash;

  return {
    subscriptionId: typeof subscriptionId === "string" ? subscriptionId : undefined,
    transactionHash: typeof transactionHash === "string" ? transactionHash : undefined,
    finalityStatus: typeof finalityStatus === "string" ? finalityStatus : undefined,
  };
};
