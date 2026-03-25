import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../../src/entry/config";

const ORIGINAL_ENV = { ...process.env };

describe("loadConfig", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WORLD_NAME;
    delete process.env.TORII_URL;
    delete process.env.WORLD_ADDRESS;
    delete process.env.RPC_URL;
    delete process.env.CHAIN;
    delete process.env.CHAIN_ID;
  });

  it("accepts explicit runtime overrides without requiring WORLD_NAME env", () => {
    delete process.env.WORLD_NAME;
    delete process.env.TORII_URL;
    delete process.env.WORLD_ADDRESS;

    const config = loadConfig({
      chain: "slot",
      rpcUrl: "https://rpc.example",
      toriiUrl: "https://torii.example",
      worldAddress: "0x123",
      chainId: "CHAIN_ID",
      dataDir: "/tmp/agent-runtime-test",
    });

    expect(config.chain).toBe("slot");
    expect(config.rpcUrl).toBe("https://rpc.example");
    expect(config.toriiUrl).toBe("https://torii.example");
    expect(config.worldAddress).toBe("0x0000000000000000000000000000000000000000000000000000000000000123");
    expect(config.chainId).toBe("CHAIN_ID");
    expect(config.dataDir).toBe("/tmp/agent-runtime-test");
  });
});
