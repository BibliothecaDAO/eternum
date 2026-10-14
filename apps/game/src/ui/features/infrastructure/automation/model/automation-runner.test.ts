import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutomationPending,
  AutomationRejected,
  AutomationSignerUnavailable,
  runAutomationTransaction,
} from "./automation-runner";
vi.mock("@bibliothecadao/eternum/game-client", () => ({ getScopedGameId: () => 1 }));
let signerId = 0;
const harness = () => ({
  signer: `0x${++signerId}`,
  operation: "transfer:1",
  signal: new AbortController().signal,
  submit: vi.fn(async () => {}),
  onConfirmed: vi.fn(),
});
afterEach(() => vi.useRealTimers());

describe("automation submission boundary", () => {
  it("delivers confirmation once and permits the next operation", async () => {
    const options = harness();
    await runAutomationTransaction(options);
    await runAutomationTransaction({ ...options, operation: "transfer:2" });
    expect(options.submit).toHaveBeenCalledTimes(2);
    expect(options.onConfirmed).toHaveBeenCalledTimes(2);
  });
  it.each(["invalid transaction nonce", "account validation failed", "insufficient max fee"])(
    "tags signer failure: %s",
    async (message) => {
      const options = harness();
      options.submit.mockRejectedValueOnce(new Error(message));
      await expect(runAutomationTransaction(options)).rejects.toBeInstanceOf(AutomationSignerUnavailable);
      expect(options.onConfirmed).not.toHaveBeenCalled();
      await runAutomationTransaction(options);
      expect(options.onConfirmed).toHaveBeenCalledTimes(1);
    },
  );
  it("preserves a gameplay rejection as a different typed failure", async () => {
    const options = harness();
    options.submit.mockRejectedValue(new Error("insufficient resource balance"));
    await expect(runAutomationTransaction(options)).rejects.toBeInstanceOf(AutomationRejected);
    expect(options.onConfirmed).not.toHaveBeenCalled();
  });
  it("does not submit when already canceled", async () => {
    const options = harness();
    await expect(runAutomationTransaction({ ...options, signal: AbortSignal.abort() })).rejects.toBeDefined();
    expect(options.submit).not.toHaveBeenCalled();
  });
  it("retains a timed-out submission and delivers its eventual receipt without sending twice", async () => {
    vi.useFakeTimers();
    const options = harness();
    let resolve!: () => void;
    options.submit.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const pending = expect(runAutomationTransaction(options)).rejects.toBeInstanceOf(AutomationPending);
    await vi.advanceTimersByTimeAsync(30_001);
    await pending;
    await expect(runAutomationTransaction({ ...options, operation: "other" })).rejects.toBeInstanceOf(
      AutomationSignerUnavailable,
    );
    resolve();
    await runAutomationTransaction(options);
    expect(options.submit).toHaveBeenCalledTimes(1);
    expect(options.onConfirmed).toHaveBeenCalledTimes(1);
  });
  it("retains a receipt across scope cancellation and suppresses the canceled callback", async () => {
    const options = harness();
    const controller = new AbortController();
    let resolve!: () => void;
    options.submit.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const stopped = expect(runAutomationTransaction({ ...options, signal: controller.signal })).rejects.toBeDefined();
    controller.abort();
    await stopped;
    resolve();
    expect(options.onConfirmed).not.toHaveBeenCalled();
    await runAutomationTransaction(options);
    expect(options.submit).toHaveBeenCalledTimes(1);
    expect(options.onConfirmed).toHaveBeenCalledTimes(1);
  });
  it("keeps an unknown transaction outcome blocked instead of treating it as a rejected action", async () => {
    const options = harness();
    const unknown = new Error("No answer yet");
    unknown.name = "TransactionNoAnswerError";
    options.submit.mockRejectedValue(unknown);
    for (let i = 0; i < 2; i++)
      await expect(runAutomationTransaction(options)).rejects.toBeInstanceOf(AutomationPending);
    expect(options.submit).toHaveBeenCalledTimes(1);
    expect(options.onConfirmed).not.toHaveBeenCalled();
  });
});

it("does not let an unobserved completed receipt starve earlier operations in the next pass", async () => {
  const options = harness();
  const controller = new AbortController();
  let resolve!: () => void;
  options.submit.mockImplementationOnce(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const stopped = expect(runAutomationTransaction({ ...options, signal: controller.signal })).rejects.toBeDefined();
  controller.abort();
  await stopped;
  resolve();
  await new Promise<void>((done) => setTimeout(done, 0));
  const earlier = vi.fn(async () => {});
  await runAutomationTransaction({ ...options, operation: "earlier", submit: earlier });
  await runAutomationTransaction(options);
  expect(earlier).toHaveBeenCalledTimes(1);
  expect(options.submit).toHaveBeenCalledTimes(1);
  expect(options.onConfirmed).toHaveBeenCalledTimes(2);
});

it("does not resubmit a confirmed action when its local receipt handler fails", async () => {
  const options = harness();
  options.onConfirmed.mockImplementationOnce(() => {
    throw new Error("receipt view unavailable");
  });
  await expect(runAutomationTransaction(options)).rejects.toThrow("receipt view unavailable");
  await runAutomationTransaction(options);
  expect(options.submit).toHaveBeenCalledTimes(1);
  expect(options.onConfirmed).toHaveBeenCalledTimes(2);
});
