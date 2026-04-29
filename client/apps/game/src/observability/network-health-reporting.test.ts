// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => {
  const captureMessage = vi.fn();
  const addBreadcrumb = vi.fn();
  const setUser = vi.fn();
  const setTags = vi.fn();
  const getCurrentScope = vi.fn(() => ({ setTags }));
  return { captureMessage, addBreadcrumb, setUser, setTags, getCurrentScope };
});

vi.mock("@sentry/react", () => ({
  captureMessage: sentryMocks.captureMessage,
  addBreadcrumb: sentryMocks.addBreadcrumb,
  setUser: sentryMocks.setUser,
  getCurrentScope: sentryMocks.getCurrentScope,
}));

vi.mock("@/runtime/world", () => ({
  getActiveWorld: () => ({ chain: "mainnet", name: "eternum" }),
}));

vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_SENTRY_DSN: "https://test@example.ingest.sentry.io/1",
    VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED: true,
    VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MIN_OUTAGE_MS: 10_000,
    VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MAX_PER_SESSION: 50,
    VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY: "none",
  },
}));

vi.stubGlobal("import.meta", { env: { PROD: true } });

import {
  addNetworkBreadcrumb,
  addToriiStreamBreadcrumb,
  reportNetworkOutageDeadEnd,
  reportNetworkOutageResolved,
  reportSubscriptionSetupTimeout,
  reportToriiQueuePressure,
  reportToriiReadinessTimeout,
  reportToriiSubscriptionLifecycle,
  resetNetworkHealthStateForTests,
  setNetworkHealthEnabledForTests,
  setNetworkHealthScopeTags,
} from "./network-health-reporting";

describe("network-health-reporting", () => {
  beforeEach(() => {
    resetNetworkHealthStateForTests();
    setNetworkHealthEnabledForTests(true);
    sentryMocks.captureMessage.mockClear();
    sentryMocks.addBreadcrumb.mockClear();
    sentryMocks.setUser.mockClear();
    sentryMocks.setTags.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("reportNetworkOutageResolved captures a warning-level message with measurements", () => {
    reportNetworkOutageResolved({ streamType: "spatial", outageMs: 45_000, attempts: 2 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("Network outage resolved");
    expect(opts.level).toBe("warning");
    expect(opts.tags.feature).toBe("network-health");
    expect(opts.tags["network.stream_type"]).toBe("spatial");
    expect(opts.tags["network.outcome"]).toBe("resolved");
    expect(opts.contexts.network.outage_seconds).toBe(45);
    expect(opts.contexts.network.reconnect_attempts).toBe(2);
    expect(opts.contexts.network.recovered).toBe(true);
  });

  it("reportNetworkOutageDeadEnd captures an error-level message", () => {
    reportNetworkOutageDeadEnd({ streamType: "global", outageMs: 120_000, attempts: 5 });

    const [, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(opts.level).toBe("error");
    expect(opts.tags["network.outcome"]).toBe("dead-end");
    expect(opts.contexts.network.recovered).toBe(false);
  });

  it("skips duplicate outage reports within the dedup window", () => {
    reportNetworkOutageResolved({ streamType: "spatial", outageMs: 45_000, attempts: 1 });
    reportNetworkOutageResolved({ streamType: "spatial", outageMs: 45_000, attempts: 1 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("skips outages below the minimum outage threshold", () => {
    reportNetworkOutageResolved({ streamType: "spatial", outageMs: 5_000, attempts: 1 });

    expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
  });

  it("reportSubscriptionSetupTimeout captures and dedups by label", () => {
    reportSubscriptionSetupTimeout({ label: "entity subscription", timeoutMs: 8000, requestId: 42 });
    reportSubscriptionSetupTimeout({ label: "entity subscription", timeoutMs: 8000, requestId: 43 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("entity subscription");
    expect(opts.tags["network.kind"]).toBe("subscription_setup_timeout");
    expect(opts.contexts.network.label).toBe("entity subscription");
  });

  it("addNetworkBreadcrumb writes a breadcrumb with structured data", () => {
    addNetworkBreadcrumb({ event: "reconnect_start", streamType: "spatial" });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    const crumb = sentryMocks.addBreadcrumb.mock.calls[0][0];
    expect(crumb.category).toBe("network-health");
    expect(crumb.message).toBe("network-health:reconnect_start");
    expect(crumb.data.stream_type).toBe("spatial");
  });

  it("setNetworkHealthScopeTags sets host and world tags", async () => {
    await setNetworkHealthScopeTags({ toriiBaseUrl: "https://api.cartridge.gg/x/s0/torii", walletAddress: null });

    expect(sentryMocks.setTags).toHaveBeenCalledTimes(1);
    const tags = sentryMocks.setTags.mock.calls[0][0];
    expect(tags["network.torii_host"]).toBe("api.cartridge.gg");
    expect(tags["chain"]).toBe("mainnet");
    expect(tags["world"]).toBe("eternum");
  });

  it("addToriiStreamBreadcrumb writes bounded stream lifecycle data", () => {
    addToriiStreamBreadcrumb({
      event: "subscription_update_succeeded",
      streamType: "spatial",
      requestId: 7,
      areaKey: "1:2",
      durationMs: 42.4,
      signatureHash: "abc123",
    });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    const crumb = sentryMocks.addBreadcrumb.mock.calls[0][0];
    expect(crumb.category).toBe("torii-stream");
    expect(crumb.message).toBe("torii-stream:subscription_update_succeeded");
    expect(crumb.data).toMatchObject({
      stream_type: "spatial",
      request_id: "7",
      area_key: "1:2",
      duration_ms: 42,
      signature_hash: "abc123",
    });
  });

  it("reportToriiSubscriptionLifecycle captures update fallback with filterable tags", () => {
    reportToriiSubscriptionLifecycle({
      streamType: "spatial",
      kind: "subscription_update",
      outcome: "fallback",
      requestId: 7,
      durationMs: 125.2,
      areaKey: "1:2",
      reason: "update failed",
    });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("subscription_update");
    expect(opts.level).toBe("warning");
    expect(opts.tags["network.stream_type"]).toBe("spatial");
    expect(opts.tags["network.kind"]).toBe("subscription_update");
    expect(opts.tags["network.outcome"]).toBe("fallback");
    expect(opts.contexts.network).toMatchObject({
      request_id: "7",
      duration_ms: 125,
      area_key: "1:2",
      reason: "update failed",
    });
  });

  it("reportToriiSubscriptionLifecycle redacts long hex values and truncates reasons", () => {
    reportToriiSubscriptionLifecycle({
      streamType: "spatial",
      kind: "fallback_recreate",
      outcome: "failed",
      reason: `failed for 0x${"a".repeat(64)} ${"x".repeat(260)}`,
    });

    const [, opts] = sentryMocks.captureMessage.mock.calls[0];
    const reason = opts.contexts.network.reason;
    expect(reason).toContain("0x[redacted]");
    expect(reason).not.toContain(`0x${"a".repeat(64)}`);
    expect(reason.length).toBeLessThanOrEqual(180);
  });

  it("reportToriiReadinessTimeout captures spatial readiness failures", () => {
    reportToriiReadinessTimeout({
      streamType: "spatial",
      requestId: 8,
      timeoutMs: 8000,
      elapsedMs: 8012.8,
    });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("readiness timed out");
    expect(opts.tags["network.kind"]).toBe("readiness_timeout");
    expect(opts.contexts.network.timeout_ms).toBe(8000);
  });

  it("reportToriiQueuePressure dedups by stream and queue bucket", () => {
    reportToriiQueuePressure({ streamType: "spatial", queueSize: 550, batchSize: 25, threshold: 500 });
    reportToriiQueuePressure({ streamType: "spatial", queueSize: 575, batchSize: 25, threshold: 500 });
    reportToriiQueuePressure({ streamType: "spatial", queueSize: 1_250, batchSize: 25, threshold: 500 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(2);
    const [, firstOpts] = sentryMocks.captureMessage.mock.calls[0];
    expect(firstOpts.tags["network.kind"]).toBe("queue_pressure");
    expect(firstOpts.tags["network.queue_bucket"]).toBe("500-999");
  });
});
