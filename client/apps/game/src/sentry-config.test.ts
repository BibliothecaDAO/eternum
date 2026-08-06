// @vitest-environment node

import { describe, expect, it } from "vitest";

import { resolveSentryRuntimeOptions } from "./sentry-config";

describe("resolveSentryRuntimeOptions", () => {
  it("preserves the previous Sentry defaults when optional environment values are absent", () => {
    const options = resolveSentryRuntimeOptions({});
    expect(options).toMatchObject({
      sendDefaultPii: true,
      tracesSampleRate: 1,
      tracePropagationTargets: ["localhost"],
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1,
      environment: "development",
      release: undefined,
      txFailuresEnabled: true,
      txFailureSampleRate: 1,
      txCaptureUserRejections: false,
      txWalletIdentity: "hashed",
    });
    expect(options.beforeSend).toEqual(expect.any(Function));
  });

  it("uses explicit Sentry environment values when they are present", () => {
    const options = resolveSentryRuntimeOptions({
      VITE_PUBLIC_CHAIN: "appchain",
      VITE_PUBLIC_GAME_VERSION: "2026.04.16",
      VITE_PUBLIC_SENTRY_ENVIRONMENT: "preview",
      VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: "0.75",
      VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: "0.25",
      VITE_PUBLIC_SENTRY_RELEASE: "release-42",
      VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII: "false",
      VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: "0.5",
      VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS: "true",
      VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE: "0.5",
      VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED: "false",
      VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY: "raw",
    });
    expect(options).toMatchObject({
      sendDefaultPii: false,
      tracesSampleRate: 0.5,
      tracePropagationTargets: ["localhost"],
      replaysSessionSampleRate: 0.25,
      replaysOnErrorSampleRate: 0.75,
      environment: "preview",
      release: "release-42",
      txFailuresEnabled: false,
      txFailureSampleRate: 0.5,
      txCaptureUserRejections: true,
      txWalletIdentity: "raw",
    });
  });
});
