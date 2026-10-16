import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  for (const key of Object.keys(import.meta.env)) if (key.startsWith("VITE_")) vi.stubEnv(key, undefined);
  vi.stubEnv("VITE_PUBLIC_L2_RPC_URL", "https://rpc.test");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("decodes every default and leaves missing optional fields absent", async () => {
  const { env } = await import("./env");
  expect(env).toStrictEqual({
    VITE_PUBLIC_L2_RPC_URL: "https://rpc.test",
    VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-auto",
    VITE_PUBLIC_GAME_VERSION: "",
    VITE_SOCIAL_LINK: "",
    VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: 1,
    VITE_PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: 0.1,
    VITE_PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: 1,
    VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII: true,
    VITE_PUBLIC_SENTRY_TX_FAILURES_ENABLED: true,
    VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE: 1,
    VITE_PUBLIC_SENTRY_TX_CAPTURE_USER_REJECTIONS: false,
    VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY: "hashed",
    VITE_PUBLIC_SENTRY_NETWORK_HEALTH_ENABLED: true,
    VITE_PUBLIC_ENABLE_MEMORY_MONITORING: false,
    VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS: 12000,
    VITE_PUBLIC_WORLDMAP_STREAMING_STAGED: true,
    VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING: true,
    VITE_PUBLIC_WORLDMAP_ZOOM_HARDENING_TELEMETRY: true,
  });
  expect(console.error).not.toHaveBeenCalled();
});

it("preserves empty DSN, strict true flags, numeric conversion and renderer resolution", async () => {
  vi.stubEnv("VITE_PUBLIC_SENTRY_DSN", "");
  vi.stubEnv("VITE_PUBLIC_CONSTRUCTION_FLAG", "TRUE");
  vi.stubEnv("VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII", "false");
  vi.stubEnv("VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE", "");
  vi.stubEnv("VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE", "NaN");
  vi.stubEnv("VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS", "0");
  vi.stubEnv("VITE_PUBLIC_RENDERER_BUILD_MODE", "experimental-webgpu-force-webgl");
  vi.stubEnv("VITE_EXTRA", "strip");
  const { env } = await import("./env");
  expect(env).toMatchObject({
    VITE_PUBLIC_SENTRY_DSN: undefined,
    VITE_PUBLIC_CONSTRUCTION_FLAG: false,
    VITE_PUBLIC_SENTRY_SEND_DEFAULT_PII: false,
    VITE_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: 0,
    VITE_PUBLIC_SENTRY_TX_FAILURE_SAMPLE_RATE: NaN,
    VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS: 0,
    VITE_PUBLIC_RENDERER_BUILD_MODE: "webgpu-force-webgl",
  });
  expect(env).not.toHaveProperty("VITE_EXTRA");
});

it.each([
  ["VITE_PUBLIC_L2_RPC_URL", "not a URL"],
  ["VITE_PUBLIC_L2_RPC_URL", undefined],
  ["VITE_PUBLIC_SENTRY_DSN", "not a URL"],
  ["VITE_SOCIAL_LINK", "not a URL"],
  ["VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS", "-1"],
  ["VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS", "Infinity"],
  ["VITE_PUBLIC_WORLDMAP_CHUNK_PHASE_TIMEOUT_MS", "NaN"],
  ["VITE_PUBLIC_SENTRY_TX_WALLET_IDENTITY", "other"],
])("rejects invalid %s = %s with the startup failure", async (key, value) => {
  vi.stubEnv(key, value);
  await expect(import("./env")).rejects.toThrow("Invalid environment variables");
  expect(console.error).toHaveBeenCalledOnce();
});
