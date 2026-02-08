import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

const ENV_KEYS = [
  "CHAIN",
  "RPC_URL",
  "TORII_URL",
  "WORLD_ADDRESS",
  "MANIFEST_PATH",
  "CHAIN_ID",
  "SESSION_BASE_PATH",
  "TICK_INTERVAL_MS",
  "LOOP_ENABLED",
  "MODEL_PROVIDER",
  "MODEL_ID",
  "GAME_NAME",
  "SLOT_NAME",
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
    process.env.CHAIN = "mainnet";
    process.env.RPC_URL = "http://rpc.example";
    process.env.TORII_URL = "http://torii.example";
    process.env.WORLD_ADDRESS = "0x123";
    process.env.MANIFEST_PATH = "/tmp/manifest.json";
    process.env.CHAIN_ID = "SN_MAIN";
    process.env.SESSION_BASE_PATH = ".session-cache";
    process.env.TICK_INTERVAL_MS = "15000";
    process.env.LOOP_ENABLED = "false";
    process.env.MODEL_PROVIDER = "openai";
    process.env.MODEL_ID = "gpt-test";
    process.env.GAME_NAME = "othergame";

    const cfg = loadConfig();

    expect(cfg.chain).toBe("mainnet");
    expect(cfg.rpcUrl).toBe("http://rpc.example");
    expect(cfg.toriiUrl).toBe("http://torii.example");
    expect(cfg.worldAddress).toBe("0x123");
    expect(cfg.manifestPath).toBe("/tmp/manifest.json");
    expect(cfg.chainId).toBe("SN_MAIN");
    expect(cfg.sessionBasePath).toBe(".session-cache");
    expect(cfg.tickIntervalMs).toBe(15000);
    expect(cfg.loopEnabled).toBe(false);
    expect(cfg.modelProvider).toBe("openai");
    expect(cfg.modelId).toBe("gpt-test");
    expect(cfg.gameName).toBe("othergame");
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

  it("parses LOOP_ENABLED with a safe default", () => {
    delete process.env.LOOP_ENABLED;
    expect(loadConfig().loopEnabled).toBe(true);

    process.env.LOOP_ENABLED = "off";
    expect(loadConfig().loopEnabled).toBe(false);

    process.env.LOOP_ENABLED = "nonsense";
    expect(loadConfig().loopEnabled).toBe(true);
  });

  it("defaults GAME_NAME to eternum", () => {
    delete process.env.GAME_NAME;
    expect(loadConfig().gameName).toBe("eternum");
  });

  it("defaults CHAIN to slot and connection fields to empty strings for auto-resolution", () => {
    delete process.env.CHAIN;
    delete process.env.RPC_URL;
    delete process.env.TORII_URL;
    delete process.env.WORLD_ADDRESS;
    delete process.env.MANIFEST_PATH;
    const cfg = loadConfig();
    expect(cfg.chain).toBe("slot");
    expect(cfg.rpcUrl).toBe("");
    expect(cfg.toriiUrl).toBe("");
    expect(cfg.worldAddress).toBe("");
    expect(cfg.manifestPath).toBe("");
  });
});
