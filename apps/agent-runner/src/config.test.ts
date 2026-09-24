import { describe, expect, it } from "vitest";

import { parseArgs, resolveConfig, resolveDataDir, RunnerConfigError } from "./config";

const FULL_ENV = { SHARD_URL: "https://shard.example" };

const resolve = (argv: string[], env: Record<string, string | undefined> = FULL_ENV) =>
  resolveConfig(parseArgs(argv), env);

describe("runner config", () => {
  it("resolves a spectator config from flags and env", () => {
    const config = resolve(["--game-id", "12", "--signer", "none"]);

    expect(config).toMatchObject({
      shardUrl: FULL_ENV.SHARD_URL,
      game: { id: 12 },
      signer: { mode: "none" },
      dataDir: null,
      modelProfile: "balanced",
      offline: false,
      maxTicks: null,
      quietWindowMs: 5_000,
      heartbeatMs: null,
    });
    expect(resolveDataDir(config, 12)).toMatch(/\.agent-data\/12$/);
  });

  it("reads the loop flags and rejects a profile the routing table does not know", () => {
    const config = resolve([
      ...["--game-id", "1", "--signer", "none", "--offline", "--max-ticks", "3"],
      ...["--quiet-window-ms", "250", "--heartbeat-ms", "1000", "--model-profile", "cheap"],
    ]);

    expect(config).toMatchObject({ offline: true, maxTicks: 3, quietWindowMs: 250, heartbeatMs: 1000 });
    expect(config.modelProfile).toBe("cheap");
    expect(() => resolve(["--game-id", "1", "--signer", "none", "--model-profile", "default"])).toThrow(
      "--model-profile must be one of cheap, balanced, strong",
    );
    expect(() => resolve(["--game-id", "1", "--signer", "none", "--max-ticks", "0"])).toThrow(
      "--max-ticks must be a positive integer",
    );
  });

  it("lets flags win over env", () => {
    const config = resolve(["--game-name", "lab-1", "--signer", "none", "--shard-url", "https://flag.example"]);

    expect(config.shardUrl).toBe("https://flag.example");
    expect(config.game).toEqual({ name: "lab-1" });
  });

  it.each([
    [["--game-id", "1", "--signer", "none"], {}, "--shard-url (or SHARD_URL"],
    [["--signer", "none"], FULL_ENV, "Missing --game-id or --game-name"],
    [["--game-id", "1"], FULL_ENV, "Missing --signer"],
    [["--game-id", "1", "--signer", "key"], FULL_ENV, "--gameplay-private-key (or GAMEPLAY_PRIVATE_KEY"],
    [
      ["--game-id", "1", "--signer", "key"],
      { ...FULL_ENV, GAMEPLAY_PRIVATE_KEY: "0x9" },
      "--gameplay-account-address (or GAMEPLAY_ACCOUNT_ADDRESS",
    ],
  ])("fails loudly for %j without the required input", (argv, env, message) => {
    expect(() => resolve(argv, env)).toThrow(RunnerConfigError);
    expect(() => resolve(argv, env)).toThrow(message);
  });

  it("rejects an unknown signer mode or a game selected twice", () => {
    expect(() => resolve(["--game-id", "1", "--signer", "wallet"])).toThrow("--signer must be bot, key, or none");
    expect(() => resolve(["--game-id", "1", "--game-name", "x", "--signer", "none"])).toThrow("not both");
    expect(() => resolve(["--game-id", "zero", "--signer", "none"])).toThrow("--game-id must be a positive integer");
  });

  it("carries the bot and key credentials it was given", () => {
    const bot = resolve(["--game-id", "1", "--signer", "bot"], {
      ...FULL_ENV,
      IDENTITY_URL: "https://identity.example/api",
      OPERATOR_TOKEN: "operator",
    });
    const key = resolve([
      "--game-id",
      "1",
      "--signer",
      "key",
      "--gameplay-private-key",
      "0xb",
      "--gameplay-account-address",
      "0xc",
    ]);

    expect(bot.signer).toEqual({ mode: "bot", identityUrl: "https://identity.example/api", operatorToken: "operator" });
    expect(() =>
      resolve(["--game-id", "1", "--signer", "bot", "--identity-url", "https://identity.example/api"]),
    ).toThrow("Missing OPERATOR_TOKEN");
    expect(key.signer).toEqual({ mode: "key", gameplayPrivateKey: "0xb", gameplayAccountAddress: "0xc" });
  });
});
