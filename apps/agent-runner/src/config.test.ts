import { describe, expect, it } from "vitest";

import { parseArgs, resolveConfig, resolveDataDir, RunnerConfigError } from "./config";

const FULL_ENV = {
  HERALD_URL: "https://herald.example",
  RPC_URL: "https://rpc.example",
  VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH: "0x1",
  VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS: "0x2",
  VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS: "0x3",
};

const resolve = (argv: string[], env: Record<string, string | undefined> = FULL_ENV) =>
  resolveConfig(parseArgs(argv), env);

describe("runner config", () => {
  it("resolves a spectator config from flags and env", () => {
    const config = resolve(["--game-id", "12", "--signer", "none"]);

    expect(config).toMatchObject({
      chain: "madara",
      heraldUrl: FULL_ENV.HERALD_URL,
      rpcUrl: FULL_ENV.RPC_URL,
      game: { id: 12 },
      playerAccountClassHash: "0x1",
      playerRegistryAddress: "0x2",
      bindingAuthorityAddress: "0x3",
      signer: { mode: "none" },
      dataDir: null,
      modelProfile: "default",
    });
    expect(config.manifestPath).toMatch(/contracts\/l3\/game\/manifest_madara\.json$/);
    expect(resolveDataDir(config, 12)).toMatch(/\.agent-data\/12$/);
  });

  it("lets flags win over env and accepts the web client's env names", () => {
    const config = resolve(["--game-name", "lab-1", "--signer", "none", "--herald-url", "https://flag.example"], {
      ...FULL_ENV,
      HERALD_URL: undefined,
      VITE_PUBLIC_HERALD_URL: "https://vite.example",
    });

    expect(config.heraldUrl).toBe("https://flag.example");
    expect(config.game).toEqual({ name: "lab-1" });
  });

  it.each([
    [
      ["--game-id", "1", "--signer", "none"],
      { ...FULL_ENV, HERALD_URL: undefined },
      "--herald-url (or HERALD_URL / VITE_PUBLIC_HERALD_URL",
    ],
    [
      ["--game-id", "1", "--signer", "none"],
      { ...FULL_ENV, RPC_URL: undefined },
      "--rpc-url (or RPC_URL / VITE_PUBLIC_NODE_URL",
    ],
    [
      ["--game-id", "1", "--signer", "none"],
      { ...FULL_ENV, VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH: undefined },
      "--player-account-class-hash (or VITE_PUBLIC_PLAYER_ACCOUNT_CLASS_HASH",
    ],
    [
      ["--game-id", "1", "--signer", "none"],
      { ...FULL_ENV, VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS: undefined },
      "--player-registry-address (or VITE_PUBLIC_PLAYER_REGISTRY_ADDRESS",
    ],
    [
      ["--game-id", "1", "--signer", "none"],
      { ...FULL_ENV, VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS: undefined },
      "--binding-authority-address (or VITE_PUBLIC_BINDING_AUTHORITY_ADDRESS",
    ],
    [["--signer", "none"], FULL_ENV, "Missing --game-id or --game-name"],
    [["--game-id", "1"], FULL_ENV, "Missing --signer"],
    [
      ["--game-id", "1", "--signer", "guest"],
      FULL_ENV,
      "--binding-authority-private-key (or BINDING_AUTHORITY_PRIVATE_KEY",
    ],
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

  it("rejects an unknown chain, signer mode, or a game selected twice", () => {
    expect(() => resolve(["--game-id", "1", "--signer", "none", "--chain", "appchain"])).toThrow(
      "--chain must be madara",
    );
    expect(() => resolve(["--game-id", "1", "--signer", "wallet"])).toThrow("--signer must be guest, key, or none");
    expect(() => resolve(["--game-id", "1", "--game-name", "x", "--signer", "none"])).toThrow("not both");
    expect(() => resolve(["--game-id", "zero", "--signer", "none"])).toThrow("--game-id must be a positive integer");
  });

  it("carries the guest and key credentials it was given", () => {
    const guest = resolve(["--game-id", "1", "--signer", "guest"], {
      ...FULL_ENV,
      BINDING_AUTHORITY_PRIVATE_KEY: "0xa",
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

    expect(guest.signer).toEqual({ mode: "guest", bindingAuthorityPrivateKey: "0xa" });
    expect(key.signer).toEqual({ mode: "key", gameplayPrivateKey: "0xb", gameplayAccountAddress: "0xc" });
  });
});
