import type { ToriiHealthUnreachableReason } from "./torii-health-probe";

/**
 * Buckets a Torii disconnect into LOCAL (the player's browser / network / CPU)
 * vs REMOTE (Torii websocket-stream or server outage) vs INDETERMINATE.
 *
 * Why this exists: the client never observes a real websocket close event
 * (torii-wasm subscriptions expose only `cancel()`), so a disconnect is always
 * detected *indirectly* — heartbeat staleness + an HTTP health probe. That makes
 * a local network drop and a remote stream death look identical in telemetry.
 * This classifier combines the few signals that *can* disambiguate the two so
 * every "Disconnected from the realm" banner event is tagged at the source.
 *
 * Pure and synchronous on purpose — all I/O (server-availability fetch) happens
 * before the snapshot is built, so this is trivially unit-testable.
 */

export type DisconnectSource = "local" | "remote" | "indeterminate";
export type DisconnectConfidence = "high" | "medium" | "low";
export type ServerAvailabilityVerdict = "alive" | "dead" | "unknown";

/** The most recent Torii HTTP health-probe outcome, flattened for the snapshot. */
export type HealthProbeSignal = ToriiHealthUnreachableReason | "reachable" | "unknown";

export interface DisconnectSignalSnapshot {
  /** `navigator.onLine` at the moment the outage was detected. */
  onLine: boolean;
  /** ms since the last browser `offline` event, or null if none observed. */
  msSinceOffline: number | null;
  /** `document.visibilityState` at detection time. */
  visibilityState: "visible" | "hidden";
  /** Most recent Torii HTTP health-probe outcome. */
  healthProbeReason: HealthProbeSignal;
  /** Whether the Torii indexer heartbeat (`onIndexerUpdated`) was ever available. */
  heartbeatAvailable: boolean;
  /** ms since the last heartbeat tick, or null if never received. */
  msSinceHeartbeat: number | null;
  /**
   * True only if the SDK surfaced a real stream close/error. torii-wasm
   * 1.7.0-preview.3 does not expose one, so this is best-effort and usually
   * false — but when present it is the single strongest REMOTE signal.
   */
  streamCloseObserved: boolean;
  /** Independent server-side reachability verdict (realtime-server probe). */
  serverAvailability: ServerAvailabilityVerdict;
}

export interface DisconnectClassification {
  source: DisconnectSource;
  confidence: DisconnectConfidence;
  /** Stable machine-readable key for telemetry grouping. */
  reason: string;
}

/** A browser `offline` event this recent counts as a live local-network cause. */
export const OFFLINE_RECENCY_MS = 30_000;

/**
 * Ordered, first-match-wins. Definitive signals (browser offline, server probe,
 * real HTTP error, real stream close) come first; inference-only buckets last.
 */
export function classifyDisconnect(signal: DisconnectSignalSnapshot): DisconnectClassification {
  const recentlyOffline = signal.msSinceOffline !== null && signal.msSinceOffline <= OFFLINE_RECENCY_MS;

  // 1. Definitive LOCAL: the browser itself reports no network.
  if (!signal.onLine || recentlyOffline) {
    return { source: "local", confidence: "high", reason: "browser_offline" };
  }

  // 2. Definitive REMOTE: an independent server-side probe says the world is down.
  if (signal.serverAvailability === "dead") {
    return { source: "remote", confidence: "high", reason: "server_unreachable" };
  }

  // 3. Definitive REMOTE: the HTTP probe got a real error response from Torii.
  if (signal.healthProbeReason === "endpoint_not_found") {
    return { source: "remote", confidence: "high", reason: "endpoint_not_found" };
  }
  if (signal.healthProbeReason === "server_error") {
    return { source: "remote", confidence: "high", reason: "server_error" };
  }

  // 4. Definitive REMOTE: the SDK surfaced an actual stream close/error.
  if (signal.streamCloseObserved) {
    return { source: "remote", confidence: "high", reason: "stream_closed" };
  }

  // 5. HTTP probe could not reach Torii (timeout / fetch error) while the browser
  //    still believes it is online.
  if (signal.healthProbeReason === "timeout" || signal.healthProbeReason === "network_error") {
    // Infra can reach the server but this client cannot => client network path.
    if (signal.serverAvailability === "alive") {
      return { source: "local", confidence: "medium", reason: "probe_failed_server_alive" };
    }
    return { source: "remote", confidence: "medium", reason: `probe_${signal.healthProbeReason}` };
  }

  // 6. HTTP is reachable but the live stream went quiet (heartbeat stale).
  if (signal.healthProbeReason === "reachable") {
    if (signal.visibilityState === "hidden") {
      // Tab was backgrounded; the health loop is paused and the indexer push may
      // have been throttled by the browser — a likely false positive.
      return { source: "local", confidence: "medium", reason: "stale_while_hidden" };
    }
    if (!signal.heartbeatAvailable) {
      // No heartbeat channel at all, so "stale" is meaningless; HTTP says alive.
      return { source: "indeterminate", confidence: "low", reason: "heartbeat_unsupported_http_ok" };
    }
    // Server HTTP is up but the stream stopped ticking -> stream/proxy drop.
    return { source: "remote", confidence: "medium", reason: "stream_stale_http_ok" };
  }

  return { source: "indeterminate", confidence: "low", reason: "unknown" };
}
