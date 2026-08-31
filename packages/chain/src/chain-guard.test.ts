import { describe, expect, it } from "vitest";

import {
  assertChainId,
  CHAIN_NAMES,
  encodeChainName,
  expectedChainId,
} from "../chain-guard.js";

describe("chain guard", () => {
  it("derives every expected id from its chain name", () => {
    expect(expectedChainId("mainnet")).toBe(
      encodeChainName(CHAIN_NAMES.mainnet),
    );
    expect(expectedChainId("appchain")).toBe(
      encodeChainName(CHAIN_NAMES.appchain),
    );
    expect(expectedChainId("madara")).toBe(encodeChainName(CHAIN_NAMES.madara));
    expect(expectedChainId("mainnet")).toBe("0x534e5f4d41494e");
    expect(expectedChainId("appchain")).toBe(
      "0x57505f5245414c4d535f444556",
    );
    expect(expectedChainId("madara")).toBe(
      "0x57505f5245414c4d535f4d41444152415f4c4142",
    );
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
      assertChainId(expectedChainId("mainnet"), "madara", "RPC_URL"),
    ).toThrow("RPC_URL is not madara");
  });

  it("refuses a lab RPC for an L2 command", () => {
    expect(() =>
      assertChainId(expectedChainId("madara"), "mainnet", "LEDGER_RPC_URL"),
    ).toThrow("LEDGER_RPC_URL is not Starknet mainnet");
  });
});
