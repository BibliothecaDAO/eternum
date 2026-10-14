import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutomationPending,
  AutomationRejected,
  AutomationSignerUnavailable,
  createAutomationTask,
} from "./automation-runner";

let signerId = 0;
const client = (world = "0xabc", chainId = "0x1") => ({ gameId: 1, shard: { chainId, worldAddress: world } });
const harness = () => {
  const run = createAutomationTask<{ label: string; amount: number }>();
  const execute = vi.fn(async (_action: { label: string; amount: number }) => {});
  const plan = vi.fn(async (submit: Parameters<Parameters<typeof run>[1]>[0]) => {
    await submit({ label: "A", amount: 10 }, execute);
  });
  return {
    run,
    execute,
    plan,
    observer: {
      client: client(),
      signer: `0x${++signerId}`,
      signal: new AbortController().signal,
      onConfirmed: vi.fn(),
    },
  };
};
afterEach(() => vi.useRealTimers());

describe("automation receipts", () => {
  it("delivers the submitted action once, then permits the next pass", async () => {
    const h = harness();
    await h.run(h.observer, h.plan);
    await h.run(h.observer, h.plan);
    expect(h.execute.mock.calls).toEqual([[{ label: "A", amount: 10 }], [{ label: "A", amount: 10 }]]);
    expect(h.observer.onConfirmed.mock.calls).toEqual(h.execute.mock.calls);
  });
  it.each(["invalid transaction nonce", "account validation failed", "insufficient max fee"])(
    "tags signer failure: %s",
    async (message) => {
      const h = harness();
      h.execute.mockRejectedValueOnce(new Error(message));
      await expect(h.run(h.observer, h.plan)).rejects.toBeInstanceOf(AutomationSignerUnavailable);
      expect(h.observer.onConfirmed).not.toHaveBeenCalled();
      await h.run(h.observer, h.plan);
      expect(h.observer.onConfirmed).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves a gameplay rejection as a different typed failure", async () => {
    const h = harness();
    h.execute.mockRejectedValue(new Error("insufficient resource balance"));
    await expect(h.run(h.observer, h.plan)).rejects.toBeInstanceOf(AutomationRejected);
    expect(h.observer.onConfirmed).not.toHaveBeenCalled();
  });
  it("does not even plan when already canceled", async () => {
    const h = harness();
    await expect(h.run({ ...h.observer, signal: AbortSignal.abort() }, h.plan)).rejects.toBeDefined();
    expect(h.plan).not.toHaveBeenCalled();
    expect(h.execute).not.toHaveBeenCalled();
  });
  it.each(["cancellation", "timeout"])(
    "reconciles A before planning B after %s, even if settings change",
    async (exit) => {
      vi.useFakeTimers();
      const h = harness();
      const controller = new AbortController();
      const original = { label: "A", amount: 10 };
      let resolve!: () => void;
      h.execute.mockImplementationOnce(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      );
      const stopped = expect(
        h.run({ ...h.observer, signal: controller.signal }, async (submit) => submit(original, h.execute)),
      ).rejects.toBeDefined();
      if (exit === "timeout") await vi.advanceTimersByTimeAsync(30_001);
      else controller.abort();
      await stopped;
      original.label = "B";
      original.amount = 99;
      resolve();
      const newPlan = vi.fn(async (submit: Parameters<Parameters<typeof h.run>[1]>[0]) => submit(original, h.execute));
      const activeConfirmed = vi.fn();
      await h.run({ ...h.observer, onConfirmed: activeConfirmed }, newPlan);
      expect(h.observer.onConfirmed).not.toHaveBeenCalled();
      expect(newPlan).not.toHaveBeenCalled();
      expect(h.execute.mock.calls).toEqual([[{ label: "A", amount: 10 }]]);
      expect(activeConfirmed.mock.calls).toEqual([[{ label: "A", amount: 10 }]]);
      await h.run({ ...h.observer, onConfirmed: activeConfirmed }, newPlan);
      expect(h.execute.mock.calls[1]).toEqual([{ label: "B", amount: 99 }]);
    },
  );
  it.each(["unresolved", "completed"])(
    "isolates %s receipts across worlds with identical game, signer and action IDs",
    async (state) => {
      const h = harness();
      const stopA = new AbortController();
      let resolve!: () => void;
      h.execute.mockImplementationOnce(
        () =>
          new Promise<void>((done) => {
            resolve = done;
          }),
      );
      const stopped = expect(h.run({ ...h.observer, signal: stopA.signal }, h.plan)).rejects.toBeDefined();
      stopA.abort();
      await stopped;
      if (state === "completed") resolve();
      const worldB = { ...h.observer, client: client("0xdef"), onConfirmed: vi.fn() };
      await h.run(worldB, h.plan);
      expect(h.execute).toHaveBeenCalledTimes(2);
      expect(worldB.onConfirmed.mock.calls).toEqual([[{ label: "A", amount: 10 }]]);
      resolve();
      const recoveredA = vi.fn();
      await h.run({ ...h.observer, client: client("0x0ABC", "0x01"), onConfirmed: recoveredA }, h.plan);
      expect(h.execute).toHaveBeenCalledTimes(2);
      expect(recoveredA.mock.calls).toEqual([[{ label: "A", amount: 10 }]]);
      expect(h.observer.onConfirmed).not.toHaveBeenCalled();
    },
  );
  it("isolates chains even when world address, game and signer are equal", async () => {
    const h = harness();
    const stop = new AbortController();
    let resolve!: () => void;
    h.execute.mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const stopped = expect(h.run({ ...h.observer, signal: stop.signal }, h.plan)).rejects.toBeDefined();
    stop.abort();
    await stopped;
    await h.run({ ...h.observer, client: client("0xabc", "0x2") }, h.plan);
    expect(h.execute).toHaveBeenCalledTimes(2);
    resolve();
    await h.run(h.observer, h.plan);
    expect(h.execute).toHaveBeenCalledTimes(2);
  });
  it("blocks other tasks for the same signer while a native transaction outcome is unknown", async () => {
    const h = harness();
    const unknown = new Error("No answer yet");
    unknown.name = "TransactionNoAnswerError";
    h.execute.mockRejectedValue(unknown);
    for (let i = 0; i < 2; i++) await expect(h.run(h.observer, h.plan)).rejects.toBeInstanceOf(AutomationPending);
    const other = harness();
    await expect(other.run(h.observer, other.plan)).rejects.toBeInstanceOf(AutomationSignerUnavailable);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(other.execute).not.toHaveBeenCalled();
  });
  it("keeps the immutable receipt if its local handler mutates data then fails", async () => {
    const h = harness();
    h.observer.onConfirmed.mockImplementationOnce((action) => {
      action.amount = 999;
      throw new Error("view unavailable");
    });
    await expect(h.run(h.observer, h.plan)).rejects.toThrow("view unavailable");
    await h.run(h.observer, h.plan);
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.observer.onConfirmed.mock.calls[1]).toEqual([{ label: "A", amount: 10 }]);
  });
});

it("does not classify disposal of native transaction observation as a rejected transaction", async () => {
  const h = harness();
  h.execute.mockRejectedValue(new Error("Game client disposed"));
  await expect(h.run(h.observer, h.plan)).rejects.toBeInstanceOf(AutomationPending);
  await expect(h.run(h.observer, h.plan)).rejects.toBeInstanceOf(AutomationPending);
  expect(h.execute).toHaveBeenCalledTimes(1);
  expect(h.observer.onConfirmed).not.toHaveBeenCalled();
});
