import * as Sentry from "@sentry/react";

import { env } from "../../env";
import { getActiveWorld } from "@/runtime/world";
import { resolveUserIdentity } from "./wallet-identity";

export type NetworkStreamType = "spatial" | "global" | "player" | "both";
type NetworkHealthEvent =
  | "outage_start"
  | "stream_stale"
  | "reconnect_start"
  | "reconnect_success"
  | "reconnect_failure"
  | "force_retry"
  | "visibility_resume"
  | "online_event";
type ToriiStreamBreadcrumbEvent =
  | "bounds_switch_requested"
  | "subscription_update_attempted"
  | "subscription_update_succeeded"
  | "subscription_update_failed"
  | "fallback_recreate_attempted"
  | "fallback_recreate_succeeded"
  | "heartbeat_received"
  | "queue_batch";

type ToriiSubscriptionLifecycleKind =
  | "subscription_setup"
  | "subscription_update"
  | "fallback_recreate"
  | "heartbeat"
  | "readiness";
type ToriiSubscriptionLifecycleOutcome = "succeeded" | "failed" | "fallback" | "timeout" | "stale";

interface OutageReport {
  streamType: NetworkStreamType;
  outageMs: number;
  attempts: number;
}

interface SetupTimeoutReport {
  label: string;
  timeoutMs: number;
  requestId?: number | string;
}

interface ToriiStreamBreadcrumbReport {
  event: ToriiStreamBreadcrumbEvent;
  streamType: NetworkStreamType;
  areaKey?: string;
  batchSize?: number;
  durationMs?: number;
  modelCount?: number;
  queueSize?: number;
  requestId?: number | string;
  signatureHash?: string;
}

interface ToriiSubscriptionLifecycleReport {
  streamType: NetworkStreamType;
  kind: ToriiSubscriptionLifecycleKind;
  outcome: ToriiSubscriptionLifecycleOutcome;
  areaKey?: string;
  durationMs?: number;
  reason?: string;
  requestId?: number | string;
  signatureHash?: string;
}

interface ToriiReadinessTimeoutReport {
  streamType: NetworkStreamType;
  elapsedMs: number;
  requestId?: number | string;
  timeoutMs: number;
}

interface ToriiQueuePressureReport {
  streamType: NetworkStreamType;
  batchSize?: number;
  queueSize: number;
  threshold: number;
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

const bucketQueueSize = (queueSize: number): string => {
  if (queueSize < 1_000) return "500-999";
  if (queueSize < 2_000) return "1000-1999";
  if (queueSize < 5_000) return "2000-4999";
  return "5000+";
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
}: {
  event: NetworkHealthEvent;
  streamType?: NetworkStreamType;
  status?: string;
  ageMs?: number;
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
    },
  });
};

const buildToriiStreamData = ({
  areaKey,
  batchSize,
  durationMs,
  modelCount,
  queueSize,
  requestId,
  signatureHash,
}: Omit<ToriiStreamBreadcrumbReport, "event" | "streamType">): Record<string, string | number> => ({
  ...(typeof requestId !== "undefined" ? { request_id: String(requestId) } : {}),
  ...(areaKey ? { area_key: areaKey } : {}),
  ...(typeof durationMs === "number" ? { duration_ms: Math.round(durationMs) } : {}),
  ...(typeof batchSize === "number" ? { batch_size: batchSize } : {}),
  ...(typeof modelCount === "number" ? { model_count: modelCount } : {}),
  ...(typeof queueSize === "number" ? { queue_size: queueSize } : {}),
  ...(signatureHash ? { signature_hash: signatureHash } : {}),
});

export const addToriiStreamBreadcrumb = ({ event, streamType, ...data }: ToriiStreamBreadcrumbReport): void => {
  if (!isEnabled()) return;

  Sentry.addBreadcrumb({
    category: "torii-stream",
    type: "default",
    level: event.includes("failed") ? "warning" : "info",
    message: `torii-stream:${event}`,
    data: {
      stream_type: streamType,
      ...buildToriiStreamData(data),
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
      },
      contexts: {
        network: {
          outage_seconds: Math.round(report.outageMs / 1000),
          reconnect_attempts: report.attempts,
          recovered,
        },
      },
      fingerprint: ["network-health", report.streamType, recovered ? "resolved" : "dead-end", bucket],
    },
  );
};

export const reportNetworkOutageResolved = (report: OutageReport): void => reportOutage(report, true);

export const reportNetworkOutageDeadEnd = (report: OutageReport): void => reportOutage(report, false);

export const reportSubscriptionSetupTimeout = ({ label, timeoutMs, requestId }: SetupTimeoutReport): void => {
  if (!isEnabled()) return;
  if (!canEmitMore()) return;

  const dedupeKey = `setup-timeout:${label}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(`Torii subscription setup timed out (${label})`, {
    level: "warning",
    tags: {
      feature: "network-health",
      "network.kind": "subscription_setup_timeout",
      "network.subscription_label": label,
    },
    contexts: {
      network: {
        label,
        timeout_ms: timeoutMs,
        ...(typeof requestId !== "undefined" ? { request_id: String(requestId) } : {}),
      },
    },
    fingerprint: ["network-health", "setup-timeout", label],
  });
};

export const reportToriiSubscriptionLifecycle = ({
  streamType,
  kind,
  outcome,
  areaKey,
  durationMs,
  reason,
  requestId,
  signatureHash,
}: ToriiSubscriptionLifecycleReport): void => {
  if (!isEnabled()) return;
  if (!canEmitMore()) return;

  const dedupeKey = `torii-lifecycle:${streamType}:${kind}:${outcome}:${areaKey ?? "none"}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  const level = outcome === "failed" ? "error" : outcome === "succeeded" ? "info" : "warning";
  Sentry.captureMessage(`Torii ${kind} ${outcome} (${streamType})`, {
    level,
    tags: {
      feature: "network-health",
      "network.stream_type": streamType,
      "network.kind": kind,
      "network.outcome": outcome,
    },
    contexts: {
      network: {
        ...(typeof requestId !== "undefined" ? { request_id: String(requestId) } : {}),
        ...(areaKey ? { area_key: areaKey } : {}),
        ...(typeof durationMs === "number" ? { duration_ms: Math.round(durationMs) } : {}),
        ...(reason ? { reason: sanitizeContextText(reason) } : {}),
        ...(signatureHash ? { signature_hash: signatureHash } : {}),
      },
    },
    fingerprint: ["network-health", "torii", streamType, kind, outcome],
  });
};

export const reportToriiReadinessTimeout = ({
  streamType,
  elapsedMs,
  requestId,
  timeoutMs,
}: ToriiReadinessTimeoutReport): void => {
  if (!isEnabled()) return;
  if (!canEmitMore()) return;

  const dedupeKey = `torii-readiness-timeout:${streamType}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(`Torii ${streamType} readiness timed out`, {
    level: "warning",
    tags: {
      feature: "network-health",
      "network.stream_type": streamType,
      "network.kind": "readiness_timeout",
      "network.outcome": "timeout",
    },
    contexts: {
      network: {
        ...(typeof requestId !== "undefined" ? { request_id: String(requestId) } : {}),
        elapsed_ms: Math.round(elapsedMs),
        timeout_ms: timeoutMs,
      },
    },
    fingerprint: ["network-health", "torii", streamType, "readiness-timeout"],
  });
};

export const reportToriiQueuePressure = ({
  streamType,
  batchSize,
  queueSize,
  threshold,
}: ToriiQueuePressureReport): void => {
  if (!isEnabled()) return;
  if (queueSize <= threshold) return;
  if (!canEmitMore()) return;

  const bucket = bucketQueueSize(queueSize);
  const dedupeKey = `torii-queue-pressure:${streamType}:${bucket}`;
  if (shouldSkipDuplicate(dedupeKey)) return;

  eventsThisSession += 1;

  Sentry.captureMessage(`Torii queue pressure (${streamType}, ${bucket})`, {
    level: "warning",
    tags: {
      feature: "network-health",
      "network.stream_type": streamType,
      "network.kind": "queue_pressure",
      "network.outcome": "pressure",
      "network.queue_bucket": bucket,
    },
    contexts: {
      network: {
        queue_size: queueSize,
        threshold,
        ...(typeof batchSize === "number" ? { batch_size: batchSize } : {}),
      },
    },
    fingerprint: ["network-health", "torii", streamType, "queue-pressure", bucket],
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
