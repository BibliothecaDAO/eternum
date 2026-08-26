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
    reportNetworkOutageResolved({ streamType: "both", outageMs: 45_000, attempts: 2 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("Network outage resolved");
    expect(opts.level).toBe("warning");
    expect(opts.tags.feature).toBe("network-health");
    expect(opts.tags["network.stream_type"]).toBe("both");
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
    reportNetworkOutageResolved({ streamType: "both", outageMs: 45_000, attempts: 1 });
    reportNetworkOutageResolved({ streamType: "both", outageMs: 45_000, attempts: 1 });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
  });

  it("skips outages below the minimum outage threshold", () => {
    reportNetworkOutageResolved({ streamType: "both", outageMs: 5_000, attempts: 1 });

    expect(sentryMocks.captureMessage).not.toHaveBeenCalled();
  });

  it("addNetworkBreadcrumb writes a breadcrumb with structured data", () => {
    addNetworkBreadcrumb({ event: "reconnect_start", streamType: "global" });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    const crumb = sentryMocks.addBreadcrumb.mock.calls[0][0];
    expect(crumb.category).toBe("network-health");
    expect(crumb.message).toBe("network-health:reconnect_start");
    expect(crumb.data.stream_type).toBe("global");
  });

  it("setNetworkHealthScopeTags sets host and world tags", async () => {
    await setNetworkHealthScopeTags({ toriiBaseUrl: "https://api.realms.world/x/s0/torii", walletAddress: null });

    expect(sentryMocks.setTags).toHaveBeenCalledTimes(1);
    const tags = sentryMocks.setTags.mock.calls[0][0];
    expect(tags["network.torii_host"]).toBe("api.realms.world");
    expect(tags["chain"]).toBe("mainnet");
    expect(tags["world"]).toBe("eternum");
  });

  it("addToriiStreamBreadcrumb records the shared heartbeat", () => {
    addToriiStreamBreadcrumb({
      event: "heartbeat_received",
      streamType: "both",
    });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledTimes(1);
    const crumb = sentryMocks.addBreadcrumb.mock.calls[0][0];
    expect(crumb.category).toBe("torii-stream");
    expect(crumb.message).toBe("torii-stream:heartbeat_received");
    expect(crumb.data).toEqual({ stream_type: "both" });
  });

  it("reportToriiSubscriptionLifecycle captures a stale shared heartbeat", () => {
    reportToriiSubscriptionLifecycle({
      streamType: "both",
      kind: "heartbeat",
      outcome: "stale",
      durationMs: 125.2,
    });

    expect(sentryMocks.captureMessage).toHaveBeenCalledTimes(1);
    const [message, opts] = sentryMocks.captureMessage.mock.calls[0];
    expect(message).toContain("heartbeat");
    expect(opts.level).toBe("warning");
    expect(opts.tags["network.stream_type"]).toBe("both");
    expect(opts.tags["network.kind"]).toBe("heartbeat");
    expect(opts.tags["network.outcome"]).toBe("stale");
    expect(opts.contexts.network).toEqual({ duration_ms: 125 });
  });
});
