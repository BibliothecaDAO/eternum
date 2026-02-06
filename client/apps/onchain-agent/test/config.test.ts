import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const ENV_KEYS = [
  "RPC_URL",
  "TORII_URL",
  "WORLD_ADDRESS",
  "MANIFEST_PATH",
  "PRIVATE_KEY",
  "ACCOUNT_ADDRESS",
  "TICK_INTERVAL_MS",
  "MODEL_PROVIDER",
  "MODEL_ID",
] as const;

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe("loadConfig", () => {
  it("reads explicit environment overrides", () => {
    process.env.RPC_URL = "http://rpc.example";
    process.env.TORII_URL = "http://torii.example";
    process.env.WORLD_ADDRESS = "0x123";
    process.env.MANIFEST_PATH = "/tmp/manifest.json";
    process.env.PRIVATE_KEY = "0xabc";
    process.env.ACCOUNT_ADDRESS = "0xdef";
    process.env.TICK_INTERVAL_MS = "15000";
    process.env.MODEL_PROVIDER = "openai";
    process.env.MODEL_ID = "gpt-test";

    const cfg = loadConfig();

    expect(cfg.rpcUrl).toBe("http://rpc.example");
    expect(cfg.toriiUrl).toBe("http://torii.example");
    expect(cfg.worldAddress).toBe("0x123");
    expect(cfg.manifestPath).toBe("/tmp/manifest.json");
    expect(cfg.privateKey).toBe("0xabc");
    expect(cfg.accountAddress).toBe("0xdef");
    expect(cfg.tickIntervalMs).toBe(15000);
    expect(cfg.modelProvider).toBe("openai");
    expect(cfg.modelId).toBe("gpt-test");
    expect(cfg.dataDir).toContain("/onchain-agent/data");
  });

  it("falls back to a sane default interval when TICK_INTERVAL_MS is invalid", () => {
    process.env.TICK_INTERVAL_MS = "not-a-number";

    const cfg = loadConfig();

    expect(cfg.tickIntervalMs).toBe(60000);
  });

  it("falls back to default interval when TICK_INTERVAL_MS is zero or negative", () => {
    process.env.TICK_INTERVAL_MS = "0";

    const zeroCfg = loadConfig();
    expect(zeroCfg.tickIntervalMs).toBe(60000);

    process.env.TICK_INTERVAL_MS = "-10";
    const negativeCfg = loadConfig();
    expect(negativeCfg.tickIntervalMs).toBe(60000);
  });
});
