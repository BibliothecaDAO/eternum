import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  rememberUncertainClaimSharePointsSubmission,
  resetUncertainSubmissionRegistryForTests,
  shouldSkipAutomaticClaimSharePointsSubmission,
} from "../ui/utils/uncertain-transaction-registry";

import { useTransactionListener } from "./use-transaction-listener";

const provider = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  return {
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((listener) => listener(...args));
    },
    on(event: string, listener: (...args: unknown[]) => void) {
      const eventListeners = listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
    },
    off(event: string, listener: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(listener);
    },
    removeAllListeners() {
      listeners.clear();
    },
  };
});

const observabilityMocks = vi.hoisted(() => ({
  addClientTransactionBreadcrumb: vi.fn(),
  reportClientTransactionFailure: vi.fn().mockResolvedValue(undefined),
}));

const storeState = vi.hoisted(() => ({
  transactions: [] as Array<Record<string, unknown>>,
  addTransaction: vi.fn((tx: Record<string, unknown>) => {
    storeState.transactions = [tx, ...storeState.transactions];
  }),
  updateTransaction: vi.fn((hash: string, updates: Record<string, unknown>) => {
    storeState.transactions = storeState.transactions.map((tx) => (tx.hash === hash ? { ...tx, ...updates } : tx));
  }),
}));

const useTransactionStoreMock = vi.hoisted(() =>
  Object.assign(
    vi.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
    {
      getState: () => storeState,
    },
  ),
);

vi.mock("@bibliothecadao/react", () => ({
  useDojo: () => ({
    setup: {
      network: {
        provider,
      },
    },
  }),
}));

vi.mock("@/hooks/store/use-transaction-store", () => ({
  useTransactionStore: useTransactionStoreMock,
}));

vi.mock("@/observability/transaction-failure-reporting", () => ({
  addClientTransactionBreadcrumb: observabilityMocks.addClientTransactionBreadcrumb,
  reportClientTransactionFailure: observabilityMocks.reportClientTransactionFailure,
}));

function HookHarness() {
  useTransactionListener();
  return null;
}

describe("useTransactionListener", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    provider.removeAllListeners();
    storeState.transactions = [];
    resetUncertainSubmissionRegistryForTests();
    storeState.addTransaction.mockClear();
    storeState.updateTransaction.mockClear();
    observabilityMocks.addClientTransactionBreadcrumb.mockClear();
    observabilityMocks.reportClientTransactionFailure.mockClear();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    provider.removeAllListeners();
    container.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it("adds breadcrumbs for submitted and completed transactions", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      provider.emit("transactionSubmitted", {
        transactionHash: "0xtx",
        type: "buy",
      });
      provider.emit("transactionComplete", {
        details: { transaction_hash: "0xtx" },
        type: "buy",
      });
    });

    expect(storeState.addTransaction).toHaveBeenCalled();
    expect(storeState.updateTransaction).toHaveBeenCalledWith(
      "0xtx",
      expect.objectContaining({
        status: "success",
      }),
    );
    expect(observabilityMocks.addClientTransactionBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "submitted" }),
    );
    expect(observabilityMocks.addClientTransactionBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "completed" }),
    );
  });

  it("reports provider transaction failures and marks the tracked transaction as reverted", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      provider.emit("transactionSubmitted", {
        transactionHash: "0xfail",
        type: "buy",
      });
      provider.emit("transactionFailed", {
        message: "Transaction failed with reason: insufficient balance",
        stage: "revert",
        transactionHash: "0xfail",
        type: "buy",
      });
    });

    expect(observabilityMocks.reportClientTransactionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          surface: "dojo_provider",
          stage: "revert",
          transactionHash: "0xfail",
        }),
      }),
    );
    expect(storeState.updateTransaction).toHaveBeenCalledWith(
      "0xfail",
      expect.objectContaining({
        status: "reverted",
        errorMessage: "insufficient balance",
      }),
    );
  });

  it("passes submit failure classification through to transaction reporting without a hash", async () => {
    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Transaction submission timed out after 20s before a transaction hash was returned",
        stage: "submit",
        type: "claim_share_points",
        failureKind: "submission_timeout_no_hash",
        providerState: "unknown",
        hasTxHash: false,
        retrySafety: "unsafe_until_wallet_checked",
      });
    });

    expect(observabilityMocks.reportClientTransactionFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          surface: "dojo_provider",
          stage: "submit",
          transactionHash: undefined,
          failureKind: "submission_timeout_no_hash",
          providerState: "unknown",
          hasTxHash: false,
          retrySafety: "unsafe_until_wallet_checked",
        }),
      }),
    );
    expect(storeState.addTransaction).not.toHaveBeenCalled();
    expect(storeState.updateTransaction).not.toHaveBeenCalled();
  });

  it("clears the unresolved claim-share-points marker after a recovered late completion", async () => {
    rememberUncertainClaimSharePointsSubmission({
      walletAddress: "0xabc",
      failureKind: "submission_timeout_no_hash",
    });
    expect(shouldSkipAutomaticClaimSharePointsSubmission("0xabc")).toBe(true);

    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      provider.emit("transactionComplete", {
        details: { transaction_hash: "0xtx" },
        type: "claim_share_points",
        recoveredFromSubmissionTimeout: true,
        signerAddress: "0xabc",
      });
    });

    expect(shouldSkipAutomaticClaimSharePointsSubmission("0xabc")).toBe(false);
  });

  it("clears the unresolved claim-share-points marker after a recovered late failure with a hash", async () => {
    rememberUncertainClaimSharePointsSubmission({
      walletAddress: "0xabc",
      failureKind: "submission_timeout_no_hash",
    });
    expect(shouldSkipAutomaticClaimSharePointsSubmission("0xabc")).toBe(true);

    await act(async () => {
      root.render(<HookHarness />);
    });

    await act(async () => {
      provider.emit("transactionFailed", {
        message: "Transaction reverted",
        stage: "revert",
        transactionHash: "0xfail",
        type: "claim_share_points",
        recoveredFromSubmissionTimeout: true,
        signerAddress: "0xabc",
      });
    });

    expect(shouldSkipAutomaticClaimSharePointsSubmission("0xabc")).toBe(false);
  });
});
