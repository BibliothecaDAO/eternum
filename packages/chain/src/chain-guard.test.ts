import { describe, expect, it } from "vitest";

import {
  assertChainId,
  encodeChainName,
  expectedChainId,
} from "../chain-guard.js";

describe("chain guard", () => {
  it("rejects another shard and a manifest without its chain identity", () => {
    const first = { shard: { chainId: encodeChainName("SHARD_A") } };
    const second = { shard: { chainId: encodeChainName("SHARD_B") } };
    expect(() =>
      assertChainId(first.shard.chainId, first, "RPC_URL"),
    ).not.toThrow();
    expect(() => assertChainId(second.shard.chainId, first, "RPC_URL")).toThrow(
      "manifest shard",
    );
    expect(() =>
      expectedChainId({
        chainId: first.shard.chainId,
      } as unknown as typeof first),
    ).toThrow("shard.chainId");
    for (const chainId of [
      undefined,
      "",
      "0x0",
      "SHARD_A",
      "0x" + "f".repeat(64),
    ]) {
      expect(() =>
        assertChainId(
          first.shard.chainId,
          { shard: { chainId } } as typeof first,
          "RPC_URL",
        ),
      ).toThrow("chainId");
    }
  });

  it("compares equivalent decimal and hexadecimal ids", () => {
    expect(() =>
      assertChainId(
        BigInt(expectedChainId("mainnet")).toString(),
        "mainnet",
        "LEDGER_RPC_URL",
      ),
    ).not.toThrow();
  });

  it("refuses a mainnet RPC for an L3 command", () => {
    expect(() =>
      assertChainId(
        expectedChainId("mainnet"),
        { shard: { chainId: encodeChainName("SHARD_A") } },
        "RPC_URL",
      ),
    ).toThrow("RPC_URL is not the manifest shard");
  });

  it("refuses a lab RPC for an L2 command", () => {
    expect(() =>
      assertChainId(encodeChainName("SHARD_A"), "mainnet", "LEDGER_RPC_URL"),
    ).toThrow("LEDGER_RPC_URL is not Starknet mainnet");
  });
});
