import { describe, expect, it } from "vitest";
import {
  classifyDisconnect,
  OFFLINE_RECENCY_MS,
  type DisconnectSignalSnapshot,
} from "./connection-disconnect-classification";

const baseSignal = (overrides: Partial<DisconnectSignalSnapshot> = {}): DisconnectSignalSnapshot => ({
  onLine: true,
  msSinceOffline: null,
  visibilityState: "visible",
  healthProbeReason: "reachable",
  heartbeatAvailable: true,
  msSinceHeartbeat: 20_000,
  streamCloseObserved: false,
  serverAvailability: "unknown",
  ...overrides,
});

describe("classifyDisconnect", () => {
  it("flags LOCAL with high confidence when the browser is offline", () => {
    const result = classifyDisconnect(baseSignal({ onLine: false }));
    expect(result).toEqual({ source: "local", confidence: "high", reason: "browser_offline" });
  });

  it("flags LOCAL when a recent offline event occurred even if onLine flipped back", () => {
    const result = classifyDisconnect(baseSignal({ onLine: true, msSinceOffline: OFFLINE_RECENCY_MS - 1 }));
    expect(result.source).toBe("local");
    expect(result.reason).toBe("browser_offline");
  });

  it("does not treat a stale offline event as a current local cause", () => {
    const result = classifyDisconnect(
      baseSignal({ onLine: true, msSinceOffline: OFFLINE_RECENCY_MS + 1, healthProbeReason: "reachable" }),
    );
    expect(result.reason).not.toBe("browser_offline");
  });

  it("flags REMOTE high when the server-side probe says the world is dead", () => {
    const result = classifyDisconnect(baseSignal({ serverAvailability: "dead", healthProbeReason: "timeout" }));
    expect(result).toEqual({ source: "remote", confidence: "high", reason: "server_unreachable" });
  });

  it("flags REMOTE high on endpoint_not_found", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "endpoint_not_found" }));
    expect(result).toEqual({ source: "remote", confidence: "high", reason: "endpoint_not_found" });
  });

  it("flags REMOTE high on server_error", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "server_error" }));
    expect(result.source).toBe("remote");
    expect(result.reason).toBe("server_error");
  });

  it("flags REMOTE high when a real stream close was observed", () => {
    const result = classifyDisconnect(baseSignal({ streamCloseObserved: true, healthProbeReason: "reachable" }));
    expect(result).toEqual({ source: "remote", confidence: "high", reason: "stream_closed" });
  });

  it("flags LOCAL when probe fails but the server is independently alive", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "timeout", serverAvailability: "alive" }));
    expect(result).toEqual({ source: "local", confidence: "medium", reason: "probe_failed_server_alive" });
  });

  it("flags REMOTE (medium) when probe fails and server status is unknown", () => {
    const result = classifyDisconnect(
      baseSignal({ healthProbeReason: "network_error", serverAvailability: "unknown" }),
    );
    expect(result).toEqual({ source: "remote", confidence: "medium", reason: "probe_network_error" });
  });

  it("flags LOCAL when the stream went stale while the tab was hidden", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "reachable", visibilityState: "hidden" }));
    expect(result).toEqual({ source: "local", confidence: "medium", reason: "stale_while_hidden" });
  });

  it("is INDETERMINATE when HTTP is reachable but there is no heartbeat channel", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "reachable", heartbeatAvailable: false }));
    expect(result).toEqual({ source: "indeterminate", confidence: "low", reason: "heartbeat_unsupported_http_ok" });
  });

  it("flags REMOTE (medium) when HTTP is up but the heartbeat stream went silent", () => {
    const result = classifyDisconnect(
      baseSignal({ healthProbeReason: "reachable", heartbeatAvailable: true, visibilityState: "visible" }),
    );
    expect(result).toEqual({ source: "remote", confidence: "medium", reason: "stream_stale_http_ok" });
  });

  it("prioritises browser-offline over every remote signal", () => {
    const result = classifyDisconnect(
      baseSignal({ onLine: false, serverAvailability: "dead", healthProbeReason: "server_error" }),
    );
    expect(result.reason).toBe("browser_offline");
  });

  it("falls back to INDETERMINATE when the probe reason is unknown", () => {
    const result = classifyDisconnect(baseSignal({ healthProbeReason: "unknown" }));
    expect(result).toEqual({ source: "indeterminate", confidence: "low", reason: "unknown" });
  });
});
