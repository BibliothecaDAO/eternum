import { afterEach, describe, expect, it, vi } from "vitest";

import { MadaraSubscriptions } from "./madara-subscriptions";
import type { ModelRegistry } from "./model-registry";

class FakeWebSocket {
  public static instances: FakeWebSocket[] = [];
  public onclose: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public onmessage: ((event: { data: string }) => void) | null = null;
  public onopen: (() => void) | null = null;

  constructor(public readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  public close(): void {}

  public send(): void {}

  public receive(payload: unknown): void {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const registry = {
  bySelector: new Map(),
  events: [],
  persistent: [],
  worldAddress: "0x123",
} as unknown as ModelRegistry;

afterEach(() => {
  FakeWebSocket.instances = [];
  vi.unstubAllGlobals();
});

describe("MadaraSubscriptions", () => {
  it("reconciles before accepting heads delivered during subscription setup", async () => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    const accepted: string[] = [];
    const subscriptions = new MadaraSubscriptions("ws://rpc.test", registry, {
      onEvent: () => undefined,
      onFatal: (error) => {
        throw error;
      },
      onHead: ({ block_number }) => {
        accepted.push(`head:${block_number}`);
      },
      onReady: () => {
        accepted.push("ready");
      },
      onReceipt: () => undefined,
    });

    const started = subscriptions.start();
    const socket = FakeWebSocket.instances[0]!;
    socket.onopen?.();
    socket.receive({ id: 1, result: "heads" });
    socket.receive({ method: "starknet_subscriptionNewHeads", params: { result: { block_number: 12, timestamp: 1 } } });
    socket.receive({ id: 2, result: "events" });
    socket.receive({ id: 3, result: "receipts" });

    await started;
    await vi.waitFor(() => expect(accepted).toEqual(["ready", "head:12"]));
    subscriptions.stop();
  });
});
