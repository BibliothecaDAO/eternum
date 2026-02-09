import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config";

const ENV_KEYS = [
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

describe("runtime path defaults", () => {
  it("defaults to user home agent paths instead of repository-relative paths", () => {
    delete process.env.MANIFEST_PATH;
    delete process.env.DATA_DIR;
    delete process.env.SESSION_BASE_PATH;
    delete process.env.ETERNUM_AGENT_HOME;

    const cfg = loadConfig();

    expect(cfg.manifestPath).toContain(".eternum-agent");
    expect(cfg.manifestPath).toContain("manifest.json");
    expect(cfg.manifestPath).not.toContain("contracts/game/manifest_local.json");

    expect(cfg.dataDir).toContain(".eternum-agent");
    expect(cfg.dataDir).toContain("data");
    expect(cfg.dataDir).not.toContain("/onchain-agent/data");

    expect(cfg.sessionBasePath).toContain(".eternum-agent");
    expect(cfg.sessionBasePath).toContain(".cartridge");
  });

  it("honors ETERNUM_AGENT_HOME when explicit paths are not provided", () => {
    process.env.ETERNUM_AGENT_HOME = "/tmp/custom-agent-home";
    delete process.env.MANIFEST_PATH;
    delete process.env.DATA_DIR;
    delete process.env.SESSION_BASE_PATH;

    const cfg = loadConfig();

    expect(cfg.manifestPath).toBe("/tmp/custom-agent-home/manifest.json");
    expect(cfg.dataDir).toBe("/tmp/custom-agent-home/data");
    expect(cfg.sessionBasePath).toBe("/tmp/custom-agent-home/.cartridge");
  });
});
