import { describe, expect, it, vi } from "vitest";
import { createTransactionReceiptWaiter } from "./transaction-confirmation";

type FakeWebSocketMessage = { data: string };

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];

  onopen: (() => void) | null = null;
  onmessage: ((event: FakeWebSocketMessage) => void) | null = null;
  onerror: ((error: unknown) => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  fail(error: Error): void {
    this.onerror?.(error);
  }

  respond(id: string | number, result: unknown): void {
    this.onmessage?.({ data: JSON.stringify({ jsonrpc: "2.0", id, result }) });
  }

  notify(params: unknown): void {
    this.onmessage?.({
      data: JSON.stringify({
        jsonrpc: "2.0",
        method: "starknet_subscriptionTransactionStatus",
        params,
      }),
    });
  }
}

const buildFakeWebSocketFactory = () => {
  FakeWebSocket.instances = [];
  return (url: string) => new FakeWebSocket(url) as any;
};

const parseSentMessage = (socket: FakeWebSocket, index: number) => JSON.parse(socket.sent[index]);

const makeReceipt = () => ({ isReverted: () => false });

const flushConnectionSetup = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const waitForSocketInstance = async (): Promise<FakeWebSocket> => {
  await vi.waitFor(() => {
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
  return FakeWebSocket.instances[0];
};

const openSocketAfterHandlersAttach = async (socket: FakeWebSocket) => {
  await vi.waitFor(() => {
    expect(socket.onopen).toEqual(expect.any(Function));
  });
  socket.open();
  await vi.waitFor(() => {
    expect(socket.sent).toHaveLength(1);
  });
};

describe("transaction confirmation waiters", () => {
  it("confirms through a transaction-status websocket subscription and fetches the receipt once", async () => {
    const receipt = makeReceipt();
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
      waitForTransaction: vi.fn(),
    };
    const waiter = createTransactionReceiptWaiter(provider, {
      mode: "websocket",
      wsUrl: "wss://rpc.example",
      websocketFactory: buildFakeWebSocketFactory(),
    });

    const confirmed = waiter.waitForTransactionReceipt("0xabc");
    await flushConnectionSetup();
    const socket = await waitForSocketInstance();
    await openSocketAfterHandlersAttach(socket);

    const subscribe = parseSentMessage(socket, 0);
    expect(subscribe).toMatchObject({
      jsonrpc: "2.0",
      method: "starknet_subscribeTransactionStatus",
      params: ["0xabc"],
    });

    socket.respond(subscribe.id, "subscription-1");
    await Promise.resolve();
    socket.notify({
      subscription_id: "subscription-1",
      result: {
        transaction_hash: "0xabc",
        status: {
          finality_status: "PRE_CONFIRMED",
          execution_status: "SUCCEEDED",
        },
      },
    });

    await expect(confirmed).resolves.toBe(receipt);
    expect(provider.getTransactionReceipt).toHaveBeenCalledWith("0xabc");
    expect(provider.waitForTransaction).not.toHaveBeenCalled();

    const unsubscribe = parseSentMessage(socket, 1);
    expect(unsubscribe).toMatchObject({
      jsonrpc: "2.0",
      method: "starknet_unsubscribe",
      params: ["subscription-1"],
    });
  });

  it("accepts array-style transaction-status websocket notifications", async () => {
    const receipt = makeReceipt();
    const provider = {
      getTransactionReceipt: vi.fn().mockResolvedValue(receipt),
      waitForTransaction: vi.fn(),
    };
    const waiter = createTransactionReceiptWaiter(provider, {
      mode: "websocket",
      wsUrl: "wss://rpc.example",
      websocketFactory: buildFakeWebSocketFactory(),
    });

    const confirmed = waiter.waitForTransactionReceipt("0xabc");
    await flushConnectionSetup();
    const socket = await waitForSocketInstance();
    await openSocketAfterHandlersAttach(socket);
    const subscribe = parseSentMessage(socket, 0);
    socket.respond(subscribe.id, "subscription-1");
    await Promise.resolve();
    socket.notify([
      "subscription-1",
      {
        transaction_hash: "0xabc",
        status: {
          finality_status: "ACCEPTED_ON_L2",
          execution_status: "SUCCEEDED",
        },
      },
    ]);

    await expect(confirmed).resolves.toBe(receipt);
    expect(provider.getTransactionReceipt).toHaveBeenCalledWith("0xabc");
  });

  it("uses polling when no websocket url is configured", async () => {
    const receipt = makeReceipt();
    const provider = {
      getTransactionReceipt: vi.fn(),
      waitForTransaction: vi.fn().mockResolvedValue(receipt),
    };
    const waiter = createTransactionReceiptWaiter(provider, { mode: "auto" });

    await expect(waiter.waitForTransactionReceipt("0xabc")).resolves.toBe(receipt);

    expect(provider.waitForTransaction).toHaveBeenCalledWith("0xabc", {
      retryInterval: 500,
      successStates: ["PRE_CONFIRMED", "ACCEPTED_ON_L2", "ACCEPTED_ON_L1"],
    });
    expect(provider.getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("uses polling when polling mode is selected even with a websocket url", async () => {
    const receipt = makeReceipt();
    const provider = {
      getTransactionReceipt: vi.fn(),
      waitForTransaction: vi.fn().mockResolvedValue(receipt),
    };
    const waiter = createTransactionReceiptWaiter(provider, {
      mode: "polling",
      wsUrl: "wss://rpc.example",
      websocketFactory: buildFakeWebSocketFactory(),
    });

    await expect(waiter.waitForTransactionReceipt("0xabc")).resolves.toBe(receipt);

    expect(FakeWebSocket.instances).toHaveLength(0);
    expect(provider.waitForTransaction).toHaveBeenCalledTimes(1);
  });

  it("falls back to polling in auto mode when websocket connection fails", async () => {
    const receipt = makeReceipt();
    const provider = {
      getTransactionReceipt: vi.fn(),
      waitForTransaction: vi.fn().mockResolvedValue(receipt),
    };
    const waiter = createTransactionReceiptWaiter(provider, {
      mode: "auto",
      wsUrl: "wss://rpc.example",
      websocketFactory: buildFakeWebSocketFactory(),
    });

    const confirmed = waiter.waitForTransactionReceipt("0xabc");
    await flushConnectionSetup();
    const socket = await waitForSocketInstance();
    socket.fail(new Error("socket failed"));

    await expect(confirmed).resolves.toBe(receipt);
    expect(provider.waitForTransaction).toHaveBeenCalledTimes(1);
  });
});
