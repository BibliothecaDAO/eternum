import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { loadConfig } from "../src/config";

const ENV_KEYS = [
  "RPC_URL",
  "TORII_URL",
  "WORLD_ADDRESS",
  "MANIFEST_PATH",
  "CHAIN_ID",
  "CHAIN",
  "SESSION_BASE_PATH",
  "TICK_INTERVAL_MS",
  "LOOP_ENABLED",
  "MODEL_PROVIDER",
  "MODEL_ID",
  "GAME_NAME",
  "DATA_DIR",
  "ETERNUM_AGENT_HOME",
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
    process.env.CHAIN_ID = "SN_MAIN";
    process.env.SESSION_BASE_PATH = ".session-cache";
    process.env.TICK_INTERVAL_MS = "15000";
    process.env.LOOP_ENABLED = "false";
    process.env.MODEL_PROVIDER = "openai";
    process.env.MODEL_ID = "gpt-test";
    process.env.GAME_NAME = "othergame";
    process.env.DATA_DIR = "/tmp/agent-data";
    process.env.ETERNUM_AGENT_HOME = "/tmp/agent-home";

    const cfg = loadConfig();

    expect(cfg.rpcUrl).toBe("http://rpc.example");
    expect(cfg.toriiUrl).toBe("http://torii.example");
    expect(cfg.worldAddress).toBe("0x123");
    expect(cfg.manifestPath).toBe("/tmp/manifest.json");
    expect(cfg.chainId).toBe("SN_MAIN");
    expect(cfg.sessionBasePath).toBe(path.resolve(".session-cache"));
    expect(cfg.tickIntervalMs).toBe(15000);
    expect(cfg.loopEnabled).toBe(false);
    expect(cfg.modelProvider).toBe("openai");
    expect(cfg.modelId).toBe("gpt-test");
    expect(cfg.gameName).toBe("othergame");
    expect(cfg.dataDir).toBe("/tmp/agent-data");
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

  it("derives chain ID from RPC_URL when CHAIN_ID is not set", () => {
    delete process.env.CHAIN_ID;
    process.env.CHAIN = "slot";
    process.env.RPC_URL = "https://api.cartridge.gg/x/my-test-world/katana/rpc/v0_9";

    const cfg = loadConfig();
    // Should be derived from URL slug, not the static KATANA fallback
    expect(cfg.chainId).not.toBe("0x4b4154414e41");
    expect(cfg.chainId.startsWith("0x")).toBe(true);
  });

  it("falls back to static chain ID when RPC_URL has no recognizable pattern", () => {
    delete process.env.CHAIN_ID;
    process.env.CHAIN = "slot";
    process.env.RPC_URL = "http://localhost:5050";

    const cfg = loadConfig();
    expect(cfg.chainId).toBe("0x4b4154414e41"); // KATANA fallback
  });

  it("explicit CHAIN_ID takes precedence over RPC_URL derivation", () => {
    process.env.CHAIN_ID = "0xcustom";
    process.env.RPC_URL = "https://api.cartridge.gg/x/my-world/katana";

    const cfg = loadConfig();
    expect(cfg.chainId).toBe("0xcustom");
  });

  // === ETERNUM_AGENT_HOME cascading defaults ===

  it("derives dataDir from ETERNUM_AGENT_HOME when DATA_DIR is absent", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/eternum-home";
    delete process.env.DATA_DIR;

    const cfg = loadConfig();
    expect(cfg.dataDir).toBe("/tmp/eternum-home/data");
  });

  it("derives sessionBasePath from ETERNUM_AGENT_HOME when SESSION_BASE_PATH is absent", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/eternum-home";
    delete process.env.SESSION_BASE_PATH;

    const cfg = loadConfig();
    expect(cfg.sessionBasePath).toBe("/tmp/eternum-home/.cartridge");
  });

  it("uses ~/.eternum-agent as default ETERNUM_AGENT_HOME when unset", () => {
    delete process.env.ETERNUM_AGENT_HOME;
    delete process.env.DATA_DIR;
    delete process.env.SESSION_BASE_PATH;

    const cfg = loadConfig();
    const home = require("node:os").homedir();
    expect(cfg.dataDir).toBe(path.join(home, ".eternum-agent", "data"));
    expect(cfg.sessionBasePath).toBe(path.join(home, ".eternum-agent", ".cartridge"));
  });

  it("ETERNUM_AGENT_HOME supports tilde expansion", () => {
    process.env.ETERNUM_AGENT_HOME = "~/my-agent";
    delete process.env.DATA_DIR;
    delete process.env.SESSION_BASE_PATH;

    const cfg = loadConfig();
    const home = require("node:os").homedir();
    expect(cfg.dataDir).toBe(path.join(home, "my-agent", "data"));
    expect(cfg.sessionBasePath).toBe(path.join(home, "my-agent", ".cartridge"));
  });

  // === DATA_DIR explicit override takes precedence ===

  it("DATA_DIR overrides ETERNUM_AGENT_HOME-derived dataDir", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/eternum-home";
    process.env.DATA_DIR = "/custom/data";

    const cfg = loadConfig();
    expect(cfg.dataDir).toBe("/custom/data");
  });

  it("SESSION_BASE_PATH overrides ETERNUM_AGENT_HOME-derived sessionBasePath", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/eternum-home";
    process.env.SESSION_BASE_PATH = "/custom/sessions";

    const cfg = loadConfig();
    expect(cfg.sessionBasePath).toBe(path.resolve("/custom/sessions"));
  });

  // === DATA_DIR resolves to absolute path ===

  it("DATA_DIR resolves relative paths to absolute", () => {
    process.env.DATA_DIR = "relative/data";

    const cfg = loadConfig();
    expect(path.isAbsolute(cfg.dataDir)).toBe(true);
    expect(cfg.dataDir).toBe(path.resolve("relative/data"));
  });

  // === ETERNUM_AGENT_HOME visibility: dataDir and sessionBasePath stay consistent ===

  it("dataDir and sessionBasePath share the same ETERNUM_AGENT_HOME root", () => {
    process.env.ETERNUM_AGENT_HOME = "/shared/root";
    delete process.env.DATA_DIR;
    delete process.env.SESSION_BASE_PATH;

    const cfg = loadConfig();
    // Both should be under /shared/root
    expect(cfg.dataDir.startsWith("/shared/root/")).toBe(true);
    expect(cfg.sessionBasePath.startsWith("/shared/root/")).toBe(true);
  });

  // === Edge cases ===

  it("ETERNUM_AGENT_HOME with trailing slash works correctly", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/eternum-home/";
    delete process.env.DATA_DIR;

    const cfg = loadConfig();
    // Should not double-slash
    expect(cfg.dataDir).toBe("/tmp/eternum-home/data");
  });

  it("ETERNUM_AGENT_HOME with whitespace is trimmed", () => {
    process.env.ETERNUM_AGENT_HOME = "  /tmp/eternum-home  ";
    delete process.env.DATA_DIR;

    const cfg = loadConfig();
    expect(cfg.dataDir).toBe("/tmp/eternum-home/data");
  });

  it("empty ETERNUM_AGENT_HOME falls back to default", () => {
    process.env.ETERNUM_AGENT_HOME = "";
    delete process.env.DATA_DIR;

    const cfg = loadConfig();
    const home = require("node:os").homedir();
    expect(cfg.dataDir).toBe(path.join(home, ".eternum-agent", "data"));
  });
});
