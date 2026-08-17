import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const getActiveWorldMock = vi.hoisted(() => vi.fn());

vi.mock("@sentry/react", () => ({
  addBreadcrumb: sentryMocks.addBreadcrumb,
  captureException: sentryMocks.captureException,
}));

vi.mock("@/runtime/world", () => ({
  getActiveWorld: getActiveWorldMock,
}));

const loadModule = async () => {
  vi.resetModules();
  return await import("./transaction-failure-reporting");
};

describe("transaction failure reporting", () => {
  beforeEach(() => {
    sentryMocks.addBreadcrumb.mockReset();
    sentryMocks.captureException.mockReset();
    getActiveWorldMock.mockReset();
    getActiveWorldMock.mockReturnValue({
      name: "alpha-world",
      chain: "appchain",
      worldAddress: "0xabc",
      toriiBaseUrl: "https://example.test/torii",
      contractsBySelector: {},
      fetchedAt: Date.now(),
    });
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_PUBLIC_SENTRY_DSN", "https://public@example.ingest.sentry.io/1");
    vi.stubEnv("VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED", "true");
    vi.stubEnv("VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE", "1");
    vi.stubEnv("VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS", "false");
    vi.stubEnv("VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY", "hashed");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("captures submitted failures with sanitized context and deduplicates repeated failures", async () => {
    const { reportClientTransactionFailure } = await loadModule();

    const error = {
      message: "Execution reverted: insufficient balance",
      calldata: ["0x1", "0x2"],
      signer: {
        privateKey: "0xsecret",
      },
    };

    await reportClientTransactionFailure({
      error,
      context: {
        surface: "amm",
        operation: "amm_execute",
        stage: "submit",
        transactionHash: "0xtx",
        walletAddress: "0x123",
        contractAddresses: ["0xrouter"],
        entrypoints: ["swap"],
      },
    });

    await reportClientTransactionFailure({
      error,
      context: {
        surface: "amm",
        operation: "amm_execute",
        stage: "submit",
        transactionHash: "0xtx",
        walletAddress: "0x123",
      },
    });

    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    const [, captureContext] = sentryMocks.captureException.mock.calls[0];
    expect(captureContext.tags).toMatchObject({
      feature: "transactions",
      "tx.surface": "amm",
      "tx.stage": "submit",
      chain: "appchain",
      world: "alpha-world",
      has_tx_hash: "true",
    });
    expect(captureContext.user.id).toMatch(/^wallet:/);
    expect(captureContext.user.id).not.toBe("0x123");
    expect(captureContext.contexts.transaction).toMatchObject({
      operation: "amm_execute",
      transactionHash: "0xtx",
      entrypoints: ["swap"],
      contractAddresses: ["0xrouter"],
    });
    expect(captureContext.extra.originalError).toMatchObject({
      calldata: "[Filtered]",
      signer: "[Filtered]",
    });
    expect(captureContext.fingerprint).toEqual([
      "client-transaction-failure",
      "amm",
      "submit",
      "amm_execute",
      "insufficient balance",
    ]);
  });

  it("skips wallet rejections by default while still leaving a breadcrumb", async () => {
    const { reportClientTransactionFailure } = await loadModule();

    await reportClientTransactionFailure({
      error: new Error("User rejected request"),
      context: {
        surface: "prediction_market",
        operation: "market_buy",
        stage: "submit",
        walletAddress: "0x123",
      },
    });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("tags provider disconnects separately from no-hash submission timeouts", async () => {
    const { reportClientTransactionFailure } = await loadModule();

    await reportClientTransactionFailure({
      error: new Error("Unable to send execute() call due to destroyed connection"),
      context: {
        surface: "dojo_provider",
        operation: "claim_share_points",
        stage: "submit",
        walletAddress: "0x123",
        failureKind: "provider_connection_destroyed",
        providerState: "destroyed",
        hasTxHash: false,
        retrySafety: "safe_after_reconnect",
      } as any,
    });

    await reportClientTransactionFailure({
      error: new Error("Transaction submission timed out after 20s before a transaction hash was returned"),
      context: {
        surface: "dojo_provider",
        operation: "claim_share_points",
        stage: "submit",
        walletAddress: "0x123",
        failureKind: "submission_timeout_no_hash",
        providerState: "unknown",
        hasTxHash: false,
        retrySafety: "unsafe_until_wallet_checked",
      } as any,
    });

    expect(sentryMocks.captureException).toHaveBeenCalledTimes(2);

    const [, disconnectContext] = sentryMocks.captureException.mock.calls[0];
    const [, timeoutContext] = sentryMocks.captureException.mock.calls[1];

    expect(disconnectContext.tags).toMatchObject({
      "tx.failure_kind": "provider_connection_destroyed",
      provider_state: "destroyed",
      has_tx_hash: "false",
    });
    expect(timeoutContext.tags).toMatchObject({
      "tx.failure_kind": "submission_timeout_no_hash",
      provider_state: "unknown",
      has_tx_hash: "false",
    });
    expect(disconnectContext.contexts.transaction).toMatchObject({
      failureKind: "provider_connection_destroyed",
      retrySafety: "safe_after_reconnect",
    });
    expect(timeoutContext.contexts.transaction).toMatchObject({
      failureKind: "submission_timeout_no_hash",
      retrySafety: "unsafe_until_wallet_checked",
    });
    expect(disconnectContext.fingerprint).toEqual([
      "client-transaction-submission",
      "provider_connection_destroyed",
      "dojo_provider",
      "claim_share_points",
    ]);
    expect(timeoutContext.fingerprint).toEqual([
      "client-transaction-submission",
      "submission_timeout_no_hash",
      "dojo_provider",
      "claim_share_points",
    ]);
  });
});
