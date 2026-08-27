import * as Sentry from "@sentry/react";

import { env } from "../../env";

type NetworkStreamType = "global" | "both";
type NetworkHealthEvent = "reconnect_start" | "reconnect_success" | "reconnect_failure" | "force_retry";

let enabledOverride: boolean | null = null;

const isEnabled = (): boolean => {
  if (enabledOverride !== null) return enabledOverride;
  return import.meta.env.PROD && Boolean(env.VITE_PUBLIC_SENTRY_DSN) && env.VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED;
};

const sanitizeReason = (value: string): string => value.replace(/0x[a-fA-F0-9]{16,}/g, "0x[redacted]").slice(0, 180);

export const addNetworkBreadcrumb = ({
  event,
  streamType,
  status,
  reason,
}: {
  event: NetworkHealthEvent;
  streamType?: NetworkStreamType;
  status?: string;
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
      ...(reason ? { reason: sanitizeReason(reason) } : {}),
    },
  });
};

export const resetNetworkHealthStateForTests = (): void => {
  enabledOverride = null;
};

export const setNetworkHealthEnabledForTests = (enabled: boolean): void => {
  enabledOverride = enabled;
};
