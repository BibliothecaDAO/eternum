import * as Sentry from "@sentry/react";

import { env } from "../../env";
import { getActiveWorld } from "@/runtime/world";
import type { DisconnectClassification, DisconnectSignalSnapshot } from "@/dojo/connection-disconnect-classification";
import { resolveUserIdentity } from "./wallet-identity";

type NetworkStreamType = "global" | "both";
type NetworkHealthEvent =
  | "outage_start"
  | "stream_stale"
  | "reconnect_start"
  | "reconnect_success"
  | "reconnect_failure"
  | "force_retry"
  | "visibility_resume"
  | "online_event";
type ToriiStreamBreadcrumbEvent = "heartbeat_received";

interface OutageReport {
  streamType: NetworkStreamType;
  outageMs: number;
  attempts: number;
  reason?: string;
}

interface ToriiStreamBreadcrumbReport {
  event: ToriiStreamBreadcrumbEvent;
  streamType: NetworkStreamType;
}

interface ToriiSubscriptionLifecycleReport {
  streamType: NetworkStreamType;
  kind: "heartbeat";
  outcome: "stale";
  durationMs?: number;
}

interface NetworkScopeTags {
  toriiBaseUrl?: string | null;
  walletAddress?: string | null;
}

const DUPLICATE_TTL_MS = 5 * 60 * 1000;
const MAX_CONTEXT_TEXT_LENGTH = 180;
const reportedKeys = new Map<string, number>();
let eventsThisSession = 0;
let enabledOverride: boolean | null = null;

const isEnabled = (): boolean => {
  if (enabledOverride !== null) return enabledOverride;
  return import.meta.env.PROD && Boolean(env.VITE_PUBLIC_SENTRY_DSN) && env.VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED;
};

const canEmitMore = (): boolean => eventsThisSession < env.VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MAX_PER_SESSION;

const bucketOutageSeconds = (outageMs: number): string => {
  const seconds = Math.floor(outageMs / 1000);
  if (seconds < 30) return "10-30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 180) return "1-3m";
  if (seconds < 600) return "3-10m";
  return "10m+";
};

const pruneReportedKeys = (now: number) => {
  for (const [key, timestamp] of reportedKeys) {
    if (now - timestamp > DUPLICATE_TTL_MS) reportedKeys.delete(key);
  }
  while (reportedKeys.size > 200) {
    const oldest = reportedKeys.keys().next().value;
    if (!oldest) break;
    reportedKeys.delete(oldest);
  }
};

const shouldSkipDuplicate = (key: string): boolean => {
  const now = Date.now();
  pruneReportedKeys(now);
  const existing = reportedKeys.get(key);
  if (existing && now - existing <= DUPLICATE_TTL_MS) return true;
  reportedKeys.set(key, now);
  return false;
};

const extractHost = (url: string | null | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

const sanitizeContextText = (value: string): string => {
  const redacted = value.replace(/0x[a-fA-F0-9]{16,}/g, "0x[redacted]");
  if (redacted.length <= MAX_CONTEXT_TEXT_LENGTH) {
    return redacted;
  }
  return `${redacted.slice(0, MAX_CONTEXT_TEXT_LENGTH - 3)}...`;
};

export const setNetworkHealthScopeTags = async ({ toriiBaseUrl, walletAddress }: NetworkScopeTags): Promise<void> => {
  if (!isEnabled()) return;

  const host = extractHost(toriiBaseUrl);
  const activeWorld = getActiveWorld();
  const walletIdentity = await resolveUserIdentity(walletAddress);

  Sentry.getCurrentScope().setTags({
    ...(host ? { "network.torii_host": host } : {}),
    ...(activeWorld?.chain ? { chain: activeWorld.chain } : {}),
    ...(activeWorld?.name ? { world: activeWorld.name } : {}),
  });

  if (walletIdentity) {
    Sentry.setUser({ id: walletIdentity });
  }
};

export const addNetworkBreadcrumb = ({
  event,
  streamType,
  status,
  ageMs,
  reason,
}: {
  event: NetworkHealthEvent;
  streamType?: NetworkStreamType;
  status?: string;
  ageMs?: number;
  reason?: string;
}): void => {
  if (!isEnabled()) return;

  Sentry.addBreadcrumb({
    category: "network-health",
    type: "default",
    level: event === "reconnect_failure" ? "warning" : "info",
    message: `network-health:${event}`,
    data: {
      ...(streamType ? { stream_type: streamType } : {}),
      ...(status ? { status } : {}),
      ...(typeof ageMs === "number" ? { age_ms: Math.round(ageMs) } : {}),
      ...(reason ? { reason: sanitizeContextText(reason) } : {}),
    },
  });
};

export const addToriiStreamBreadcrumb = ({ event, streamType }: ToriiStreamBreadcrumbReport): void => {
  if (!isEnabled()) return;

  Sentry.addBreadcrumb({
    category: "torii-stream",
    type: "default",
    level: "info",
    message: `torii-stream:${event}`,
    data: {
      stream_type: streamType,
    },
  });
};

const reportOutage = (report: OutageReport, recovered: boolean): void => {
  if (!isEnabled()) return;
  if (report.outageMs < env.VITE_PUBLIC_SENTRY_NETWORK_HEALTH_MIN_OUTAGE_MS) return;
  if (!canEmitMore()) return;

  const bucket = bucketOutageSeconds(report.outageMs);
  const dedupeKey = `outage:${report.streamType}:${bucket}:${recovered ? "resolved" : "dead-end"}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(
    recovered
      ? `Network outage resolved (${report.streamType}, ~${bucket})`
      : `Network outage dead-end (${report.streamType}, ~${bucket})`,
    {
      level: recovered ? "warning" : "error",
      tags: {
        feature: "network-health",
        "network.stream_type": report.streamType,
        "network.outcome": recovered ? "resolved" : "dead-end",
        "network.duration_bucket": bucket,
        ...(report.reason ? { "network.reason": report.reason } : {}),
      },
      contexts: {
        network: {
          outage_seconds: Math.round(report.outageMs / 1000),
          reconnect_attempts: report.attempts,
          recovered,
          ...(report.reason ? { reason: sanitizeContextText(report.reason) } : {}),
        },
      },
      fingerprint: ["network-health", report.streamType, recovered ? "resolved" : "dead-end", bucket],
    },
  );
};

export const reportNetworkOutageResolved = (report: OutageReport): void => reportOutage(report, true);

export const reportNetworkOutageDeadEnd = (report: OutageReport): void => reportOutage(report, false);

/**
 * Emits the single "is this disconnect LOCAL or REMOTE" verdict at outage start.
 */
export const reportDisconnectClassification = (
  classification: DisconnectClassification,
  snapshot: DisconnectSignalSnapshot,
): void => {
  if (!isEnabled()) return;
  if (!canEmitMore()) return;

  const dedupeKey = `disconnect-classification:${classification.source}:${classification.reason}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(`Torii disconnect classified: ${classification.source} (${classification.reason})`, {
    level: classification.source === "remote" ? "error" : "warning",
    tags: {
      feature: "network-health",
      "network.kind": "disconnect_classification",
      "network.disconnect_source": classification.source,
      "network.disconnect_reason": classification.reason,
      "network.disconnect_confidence": classification.confidence,
      "network.server_availability": snapshot.serverAvailability,
    },
    contexts: {
      network: {
        on_line: snapshot.onLine,
        ...(snapshot.msSinceOffline !== null ? { ms_since_offline: snapshot.msSinceOffline } : {}),
        visibility_state: snapshot.visibilityState,
        health_probe_reason: snapshot.healthProbeReason,
        heartbeat_available: snapshot.heartbeatAvailable,
        ...(snapshot.msSinceHeartbeat !== null ? { ms_since_heartbeat: snapshot.msSinceHeartbeat } : {}),
        stream_close_observed: snapshot.streamCloseObserved,
        server_availability: snapshot.serverAvailability,
      },
    },
    fingerprint: ["network-health", "disconnect-classification", classification.source, classification.reason],
  });
};

export const reportToriiSubscriptionLifecycle = ({
  streamType,
  kind,
  outcome,
  durationMs,
}: ToriiSubscriptionLifecycleReport): void => {
  if (!isEnabled()) return;
  if (!canEmitMore()) return;

  const dedupeKey = `torii-lifecycle:${streamType}:${kind}:${outcome}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(`Torii ${kind} ${outcome} (${streamType})`, {
    level: "warning",
    tags: {
      feature: "network-health",
      "network.stream_type": streamType,
      "network.kind": kind,
      "network.outcome": outcome,
    },
    contexts: {
      network: {
        ...(typeof durationMs === "number" ? { duration_ms: Math.round(durationMs) } : {}),
      },
    },
    fingerprint: ["network-health", "torii", streamType, kind, outcome],
  });
};

export const resetNetworkHealthStateForTests = (): void => {
  reportedKeys.clear();
  eventsThisSession = 0;
  enabledOverride = null;
};

export const setNetworkHealthEnabledForTests = (enabled: boolean): void => {
  enabledOverride = enabled;
};
