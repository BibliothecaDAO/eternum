import { describe, expect, it, vi } from "vitest";

import { attachRuntimeTransactionObserver } from "./runtime-transaction-events";

describe("attachRuntimeTransactionObserver", () => {
  it("emits correlated tx lifecycle events and keeps the tool context for late confirmations", () => {
    const providerListeners = new Map<string, (...args: any[]) => void>();
    const runtimeEventListeners = new Set<(event: { type: string; payload?: Record<string, unknown> }) => void>();
    const emittedEvents: Array<{ type: string; payload?: Record<string, unknown> }> = [];

    const runtime = {
      emit: vi.fn((event: { type: string; payload?: Record<string, unknown> }) => {
        emittedEvents.push(event);
      }),
      onEvent(listener: (event: { type: string; payload?: Record<string, unknown> }) => void) {
        runtimeEventListeners.add(listener);
        return () => runtimeEventListeners.delete(listener);
      },
    };

    const cleanup = attachRuntimeTransactionObserver({
      provider: {
        on(event: string, listener: (...args: any[]) => void) {
          providerListeners.set(event, listener);
        },
        off(event: string) {
          providerListeners.delete(event);
        },
      } as any,
      runtime: runtime as any,
    });

    runtimeEventListeners.forEach((listener) =>
      listener({
        type: "tool_execution_start",
        payload: {
          toolName: "move_army",
        },
      }),
    );

    providerListeners.get("transactionSubmitted")?.({
      transactionHash: "0xabc",
      actionSummaries: [
        {
          contractAddress: "0xmove",
          entrypoint: "explorer_move",
          calldataSummary: "explorer_id=191, directions=[0,5], explore=0",
        },
      ],
    });

    runtimeEventListeners.forEach((listener) =>
      listener({
        type: "tool_execution_end",
        payload: {
          toolName: "move_army",
          isError: false,
        },
      }),
    );

    providerListeners.get("transactionComplete")?.({
      transactionHash: "0xabc",
      details: {
        execution_status: "SUCCEEDED",
      },
    });

    cleanup();

    expect(emittedEvents).toEqual([
      {
        type: "managed_runtime.transaction_submitted",
        payload: expect.objectContaining({
          toolName: "move_army",
          contractAddress: "0xmove",
          entrypoint: "explorer_move",
          txHash: "0xabc",
        }),
      },
      {
        type: "managed_runtime.transaction_confirmed",
        payload: expect.objectContaining({
          toolName: "move_army",
          txHash: "0xabc",
          receiptStatus: "SUCCEEDED",
          isError: false,
        }),
      },
    ]);
  });
});
