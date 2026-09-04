// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({ addBreadcrumb: vi.fn() }));

vi.mock("@sentry/react", () => ({ addBreadcrumb: sentryMocks.addBreadcrumb }));
vi.mock("../../env", () => ({
  env: {
    VITE_PUBLIC_SENTRY_DSN: "https://test@example.ingest.sentry.io/1",
    VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED: true,
  },
}));

import {
  addNetworkBreadcrumb,
  resetNetworkHealthStateForTests,
  setNetworkHealthEnabledForTests,
} from "./network-health-reporting";

describe("network-health-reporting", () => {
  beforeEach(() => {
    resetNetworkHealthStateForTests();
    setNetworkHealthEnabledForTests(true);
    sentryMocks.addBreadcrumb.mockClear();
  });

  it("records an explicit stream recovery without a health poll", () => {
    addNetworkBreadcrumb({ event: "reconnect_start", streamType: "global" });

    expect(sentryMocks.addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "network-health",
        message: "network-health:reconnect_start",
        data: { stream_type: "global" },
      }),
    );
  });
});
