import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { ActionOutcomeUnknownError, createNativeTicketSubmission, StaleActionNonceError } from "./native-ticket";

const channels = vi.hoisted(
  () =>
    [] as Array<{
      nodeUrl: string;
      websocket: object;
      connected: boolean;
      sent: Array<{ id: number; method: string; params: unknown }>;
      listeners: Map<string, (event: any) => void>;
      disconnect: ReturnType<typeof vi.fn>;
      open(): void;
      message(value: unknown): void;
    }>,
);
vi.mock("starknet", async (original) => ({
  ...(await original<typeof import("starknet")>()),
  WebSocketChannel: class {
    websocket = {};
    connected = false;
    sent: Array<{ id: number; method: string; params: unknown }> = [];
    listeners = new Map<string, (event: any) => void>();
    nodeUrl: string;
    disconnect = vi.fn(() => {
      this.connected = false;
    });
    constructor({ nodeUrl }: { nodeUrl: string }) {
      this.nodeUrl = nodeUrl;
      channels.push(this);
    }
    on(name: string, listener: (event: any) => void) {
      this.listeners.set(name, listener);
    }
    isConnected() {
      return this.connected;
    }
    send(method: string, params: unknown) {
      const id = this.sent.length;
      this.sent.push({ id, method, params });
      return id;
    }
    open() {
      this.connected = true;
      this.listeners.get("open")?.({});
    }
    message(value: unknown) {
      this.listeners.get("message")?.({ data: JSON.stringify(value) });
    }
  },
}));

const vector = readFileSync(
  new URL("../../../contracts/l3/randomness-protocol/tests/fixtures/v5.txt", import.meta.url),
  "utf8",
)
  .trim()
  .split(/\s+/);
const intentLength = Number(BigInt(vector[1]));
const signed = { intent: vector.slice(2, 2 + intentLength), signature: ["0x3", "0x4"] };
const action = vector[2 + intentLength];
const transports: Array<ReturnType<typeof createNativeTicketSubmission>> = [];
const transport = () => {
  const submit = createNativeTicketSubmission("https://node.test/rpc/v0_10_2");
  transports.push(submit);
  return submit;
};
const status = (result: object, subscription = "ticket-1") =>
  channels[0].message({ method: "game_action", params: { subscription, result: { action, ...result } } });
const connected = () => {
  channels[0].open();
  channels[0].message({ id: 0, result: "ticket-1" });
};
afterEach(() => {
  transports.splice(0).forEach((submit) => submit.dispose());
  channels.length = 0;
  vi.useRealTimers();
});

describe("node action subscriptions", () => {
  it("uses one subscription and waits for the ticket's recorded outcome, not the first batch hash", async () => {
    const pending = transport()(signed);
    connected();
    expect(channels[0].nodeUrl).toBe("wss://node.test/rpc/v0_10_2");
    expect(channels[0].sent).toEqual([{ id: 0, method: "game_subscribeAction", params: [signed] }]);
    let completed = false;
    void pending.then(() => {
      completed = true;
    });
    status({ status: "submitted", order: 7, transaction_hash: "0x11" });
    await Promise.resolve();
    expect(completed).toBe(false);
    status({
      status: "recorded",
      order: 7,
      transaction_hash: "0x99",
      succeeded: false,
      reason: "0x2",
      nonce_consumed: true,
    });
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99", order: 7n });
  });

  it("holds a ticket for 30 s with no timeout and no poll", async () => {
    vi.useFakeTimers();
    const pending = transport()(signed);
    connected();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(channels[0].sent).toHaveLength(1);
    status({ status: "recorded", order: 7, transaction_hash: "0x99" });
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99", order: 7n });
  });

  it("reuses a pending intent and the connection for subsequent actions", async () => {
    const submit = transport();
    const pending = submit(signed);
    expect(submit(signed)).toBe(pending);
    connected();
    status({ status: "recorded", order: 7, transaction_hash: "0x99" });
    await pending;
    const second = submit(signed);
    expect(channels).toHaveLength(1);
    channels[0].message({ id: 1, result: "ticket-2" });
    status({ status: "recorded", order: 7, transaction_hash: "0x99" }, "ticket-2");
    await second;
  });

  it("resubmits the same signed intent after reconnect and accepts reassignment after restart", async () => {
    const pending = transport()(signed);
    connected();
    status({ status: "accepted", order: 7 });
    channels[0].websocket = {};
    channels[0].open();
    channels[0].open(); // The SDK may announce the same reconnected socket twice.
    expect(channels[0].sent).toHaveLength(2);
    expect(channels[0].sent[1].params).toEqual([signed]);
    channels[0].message({ id: 1, result: "ticket-2" });
    status({ status: "recorded", order: 9, transaction_hash: "0x99" }, "ticket-2");
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99", order: 9n });
  });

  it("does not consume another ticket's outcome", async () => {
    const pending = transport()(signed);
    connected();
    status({ status: "recorded", action: "0x999", order: 7, transaction_hash: "0x99" });
    await expect(pending).rejects.toThrow("identity mismatch");
  });

  it("surfaces admission errors without a retry loop", async () => {
    const pending = transport()(signed);
    channels[0].open();
    channels[0].message({ id: 0, error: { code: -32001, message: "player already has a pending action" } });
    await expect(pending).rejects.toThrow("player already has a pending action");
    expect(channels[0].sent).toHaveLength(1);
  });

  it("surfaces a refused queued action", async () => {
    const pending = transport()(signed);
    connected();
    status({ status: "refused", reason: "intent expired before acceptance" });
    await expect(pending).rejects.toThrow("intent expired before acceptance");
  });

  it("releases pending actions and closes the socket on disposal", async () => {
    const submit = transport();
    const pending = submit(signed);
    connected();
    submit.dispose();
    await expect(pending).rejects.toThrow("disposed");
    expect(channels[0].disconnect).toHaveBeenCalledOnce();
    await expect(submit(signed)).rejects.toThrow("disposed");
  });

  it("sends the same signed intent once more at 60 s and fails with a named error at 120 s", async () => {
    vi.useFakeTimers();
    const pending = transport()(signed);
    connected();
    let failure: unknown;
    pending.catch((error) => (failure = error));
    await vi.advanceTimersByTimeAsync(59_999);
    expect(channels[0].sent).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(channels[0].sent).toHaveLength(2);
    expect(channels[0].sent[1].params).toEqual(channels[0].sent[0].params);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(failure).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(failure).toBeInstanceOf(ActionOutcomeUnknownError);
    expect(channels[0].sent).toHaveLength(2);
  });

  it("retries a busy admission with backoff inside the window, not as the resubmission", async () => {
    vi.useFakeTimers();
    const pending = transport()(signed);
    channels[0].open();
    channels[0].message({ id: 0, error: { code: -32001, message: "game admission queue is full or unavailable" } });
    await vi.advanceTimersByTimeAsync(500);
    channels[0].message({ id: 1, error: { code: -32001, message: "request rate exceeded" } });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(channels[0].sent.map(({ params }) => params)).toEqual([[signed], [signed], [signed]]);
    channels[0].message({ id: 2, result: "ticket-1" });
    status({ status: "recorded", order: 7, transaction_hash: "0x99" });
    await expect(pending).resolves.toEqual({ transaction_hash: "0x99", order: 7n });
  });

  it("fails an intent signed against a nonce the sequencer has moved past, without re-signing", async () => {
    const pending = transport()(signed);
    channels[0].open();
    channels[0].message({
      id: 0,
      error: { code: -32001, message: "actor nonce is not current; no matching action in reconnect history" },
    });
    await expect(pending).rejects.toBeInstanceOf(StaleActionNonceError);
    expect(channels[0].sent).toHaveLength(1);
  });
});
