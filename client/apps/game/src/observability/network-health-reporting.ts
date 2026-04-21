import * as Sentry from "@sentry/react";

import { env } from "../../env";
import { getActiveWorld } from "@/runtime/world";
import { resolveUserIdentity } from "./wallet-identity";

type NetworkStreamType = "spatial" | "global" | "both";
type NetworkHealthEvent =
  | "outage_start"
  | "stream_stale"
  | "reconnect_start"
  | "reconnect_success"
  | "reconnect_failure"
  | "force_retry"
  | "visibility_resume"
  | "online_event";

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

interface NetworkScopeTags {
  toriiBaseUrl?: string | null;
  walletAddress?: string | null;
}

const DUPLICATE_TTL_MS = 5 * 60 * 1000;
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

export const resetNetworkHealthStateForTests = (): void => {
  reportedKeys.clear();
  eventsThisSession = 0;
  enabledOverride = null;
};

export const setNetworkHealthEnabledForTests = (enabled: boolean): void => {
  enabledOverride = enabled;
};
