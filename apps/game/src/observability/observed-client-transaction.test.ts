import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disposeActiveGameSyncRuntime,
  GameSyncRuntime,
  installGameSyncRuntime,
  type GameSyncSubscriptionHandlers,
} from "@bibliothecadao/eternum/game-sync";

const reporterMocks = vi.hoisted(() => ({
  addClientTransactionBreadcrumb: vi.fn(),
  reportClientTransactionFailure: vi.fn().mockResolvedValue(undefined),
  resolveClientTransactionFailureStageFromError: vi.fn((_error, fallback) => fallback),
}));

vi.mock("./transaction-failure-reporting", () => ({
  addClientTransactionBreadcrumb: reporterMocks.addClientTransactionBreadcrumb,
  reportClientTransactionFailure: reporterMocks.reportClientTransactionFailure,
  resolveClientTransactionFailureStageFromError: reporterMocks.resolveClientTransactionFailureStageFromError,
}));

import { executeObservedClientTransaction } from "./observed-client-transaction";

describe("executeObservedClientTransaction", () => {
  beforeEach(() => {
    reporterMocks.addClientTransactionBreadcrumb.mockReset();
    reporterMocks.reportClientTransactionFailure.mockReset();
    reporterMocks.reportClientTransactionFailure.mockResolvedValue(undefined);
    reporterMocks.resolveClientTransactionFailureStageFromError.mockReset();
    reporterMocks.resolveClientTransactionFailureStageFromError.mockImplementation((_error, fallback) => fallback);
  });

  afterEach(() => {
    disposeActiveGameSyncRuntime();
    vi.restoreAllMocks();
  });

  it("reports submit failures", async () => {
    const account = {
      address: "0xabc",
      execute: vi.fn().mockRejectedValue(new Error("submit failed")),
      getNonce: vi.fn().mockResolvedValue("0x1"),
    };

    await expect(
      executeObservedClientTransaction({
        account,
        calls: { contractAddress: "0x1", entrypoint: "swap", calldata: [] },
        surface: "amm",
        operation: "amm_execute",
        chain: "appchain",
      }),
    ).rejects.toThrow("submit failed");

    expect(reporterMocks.reportClientTransactionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          surface: "amm",
          operation: "amm_execute",
          stage: "submit",
          walletAddress: "0xabc",
        }),
      }),
    );
  });

  it("reports confirmation failures after submission", async () => {
    const account = {
      address: "0xabc",
      execute: vi.fn().mockResolvedValue({ transaction_hash: "0xtx" }),
      getNonce: vi.fn().mockResolvedValue("0x1"),
      waitForTransaction: vi.fn().mockRejectedValue(new Error("confirmation failed")),
    };

    await expect(
      executeObservedClientTransaction({
        account,
        calls: { contractAddress: "0x1", entrypoint: "swap", calldata: [] },
        surface: "amm",
        operation: "amm_execute",
        chain: "appchain",
      }),
    ).rejects.toThrow("confirmation failed");

    expect(reporterMocks.addClientTransactionBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: "submitted",
      }),
    );
    expect(reporterMocks.reportClientTransactionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          stage: "confirmation",
          transactionHash: "0xtx",
        }),
      }),
    );
  });

  it("adds breadcrumbs for successful transactions without reporting failures", async () => {
    const account = {
      address: "0xabc",
      execute: vi.fn().mockResolvedValue({ transaction_hash: "0xtx" }),
      getNonce: vi.fn().mockResolvedValue("0x1"),
      waitForTransaction: vi.fn().mockResolvedValue({}),
    };

    await expect(
      executeObservedClientTransaction({
        account,
        calls: { contractAddress: "0x1", entrypoint: "swap", calldata: [] },
        surface: "prediction_market",
        operation: "market_buy",
        chain: "appchain",
      }),
    ).resolves.toEqual({ transaction_hash: "0xtx" });

    expect(reporterMocks.addClientTransactionBreadcrumb).toHaveBeenCalledTimes(2);
    expect(reporterMocks.addClientTransactionBreadcrumb).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ stage: "submitted" }),
    );
    expect(reporterMocks.addClientTransactionBreadcrumb).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ stage: "completed" }),
    );
    expect(reporterMocks.reportClientTransactionFailure).not.toHaveBeenCalled();
  });

  it("resolves gameplay transactions from the active Herald channel", async () => {
    let handlers!: GameSyncSubscriptionHandlers;
    const runtime = installGameSyncRuntime(new GameSyncRuntime());
    await runtime.startSession({
      snapshotModels: [],
      store: {
        applyEntityOperations: () => undefined,
        applyEvent: () => undefined,
        listModelEntityIds: () => [],
      },
      transport: {
        transactionStatusChannel: true,
        subscribe: async (nextHandlers) => {
          handlers = nextHandlers;
          return { cancel: () => undefined };
        },
        fetchSnapshotPage: async () => ({ items: [] }),
      },
    });
    const account = {
      address: "0xstream",
      execute: vi.fn().mockResolvedValue({ transaction_hash: "0xabc" }),
      getNonce: vi.fn().mockResolvedValue("0x1"),
      waitForTransaction: vi.fn().mockResolvedValue({}),
    };

    const submitted = executeObservedClientTransaction({
      account,
      calls: { contractAddress: "0x1", entrypoint: "swap", calldata: [] },
      surface: "amm",
      operation: "amm_execute",
      chain: "madara",
    });
    await vi.waitFor(() => expect(account.execute).toHaveBeenCalledOnce());
    handlers.onTransaction?.({ block: null, hash: "0x0abc", status: "PRE_CONFIRMED" });

    await expect(submitted).resolves.toEqual({ transaction_hash: "0xabc" });
    expect(account.waitForTransaction).not.toHaveBeenCalled();
  });
});
