import { describe, expect, it, vi } from "vitest";
import { scheduleAutomationResourceCleanup } from "./automation-resource-cleanup";

describe("scheduleAutomationResourceCleanup", () => {
  it("keeps cleanup pending until the transaction confirmation waiter settles", async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();
    let confirmTransaction!: () => void;
    const confirmation = new Promise<void>((resolve) => {
      confirmTransaction = resolve;
    });
    const signer = {
      provider: {
        waitForTransactionWithCheck: vi.fn(() => confirmation),
      },
    };

    scheduleAutomationResourceCleanup({
      signer,
      result: { transaction_hash: "0xabc" },
      cleanup,
    });

    expect(cleanup).not.toHaveBeenCalled();
    expect(signer.provider.waitForTransactionWithCheck).toHaveBeenCalledWith("0xabc");

    confirmTransaction();
    await confirmation;
    await Promise.resolve();

    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uses the fallback timeout when confirmation does not settle", () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();
    const signer = {
      provider: {
        waitForTransactionWithCheck: vi.fn(() => new Promise(() => {})),
      },
    };

    scheduleAutomationResourceCleanup({
      signer,
      result: { transaction_hash: "0xabc" },
      cleanup,
      fallbackTimeoutMs: 10,
    });

    expect(cleanup).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);

    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("uses the fallback timeout when a transaction hash has no confirmation waiter", () => {
    vi.useFakeTimers();
    const cleanup = vi.fn();

    scheduleAutomationResourceCleanup({
      signer: { address: "0xabc" },
      result: { transaction_hash: "0xabc" },
      cleanup,
      fallbackTimeoutMs: 10,
    });

    expect(cleanup).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10);

    expect(cleanup).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
