import { describe, expect, it } from "vitest";
import {
  InvalidIndexerRuntimeConfigError,
  InvalidIndexerStartingBlockError,
  resolveIndexerRuntimeConfig,
  resolveIndexerStartingBlock,
} from "./runtime-config";

describe("resolveIndexerRuntimeConfig", () => {
  it("accepts a non-zero factory address and valid rpc url", () => {
    expect(
      resolveIndexerRuntimeConfig({
        factoryAddress: "0x0123",
        rpcUrl: "https://starknet.example/rpc",
      }),
    ).toEqual({
      factoryAddress: "0x123",
      rpcUrl: "https://starknet.example/rpc",
    });
  });

  it("rejects a zero factory address", () => {
    expect(() =>
      resolveIndexerRuntimeConfig({
        factoryAddress: "0x0",
        rpcUrl: "https://starknet.example/rpc",
      }),
    ).toThrow(InvalidIndexerRuntimeConfigError);
  });

  it("rejects an invalid rpc url", () => {
    expect(() =>
      resolveIndexerRuntimeConfig({
        factoryAddress: "0x123",
        rpcUrl: "not-a-url",
      }),
    ).toThrow(InvalidIndexerRuntimeConfigError);
  });
});

describe("resolveIndexerStartingBlock", () => {
  it("defaults to the current head block when STARTING_BLOCK is unset", async () => {
    await expect(
      resolveIndexerStartingBlock(
        {
          rpcUrl: "https://starknet.example/rpc",
          startingBlock: undefined,
        },
        async () => 12345,
      ),
    ).resolves.toBe(12345n);
  });

  it("accepts a configured starting block at the current head", async () => {
    await expect(
      resolveIndexerStartingBlock(
        {
          rpcUrl: "https://starknet.example/rpc",
          startingBlock: "12345",
        },
        async () => 12345,
      ),
    ).resolves.toBe(12345n);
  });

  it("rejects an invalid STARTING_BLOCK value", async () => {
    await expect(
      resolveIndexerStartingBlock(
        {
          rpcUrl: "https://starknet.example/rpc",
          startingBlock: "not-a-number",
        },
        async () => 12345,
      ),
    ).rejects.toThrow(InvalidIndexerStartingBlockError);
  });

  it("accepts a historical STARTING_BLOCK so the seed can target that same block", async () => {
    await expect(
      resolveIndexerStartingBlock(
        {
          rpcUrl: "https://starknet.example/rpc",
          startingBlock: "12000",
        },
        async () => 12345,
      ),
    ).resolves.toBe(12000n);
  });
});
