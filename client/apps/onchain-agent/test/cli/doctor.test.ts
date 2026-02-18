import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
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
  vi.restoreAllMocks();
});

describe("doctor command", () => {
  it("fails when manifest path does not exist", async () => {
    const base = mkdtempSync(join(tmpdir(), "onchain-doctor-"));
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    process.env.ETERNUM_AGENT_HOME = base;
    process.env.DATA_DIR = join(base, "data");
    process.env.SESSION_BASE_PATH = join(base, ".cartridge");
    process.env.MANIFEST_PATH = join(base, "missing-manifest.json");
    process.env.WORLD_ADDRESS = "0x123";
    process.env.RPC_URL = "http://localhost:5050";
    process.env.TORII_URL = "http://localhost:8080";

    try {
      const { runCli } = await import("../../src/cli");
      const code = await runCli(["doctor"]);

      expect(code).toBe(1);
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("MANIFEST_PATH"));
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
