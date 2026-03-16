// @vitest-environment node
import { describe, expect, it } from "vitest";

import { buildBlitzRegisterCalls } from "./blitz-registration";

describe("buildBlitzRegisterCalls", () => {
  it("emits an explicit empty cosmetic span when no cosmetics are selected", () => {
    const calls = buildBlitzRegisterCalls({
      blitzSystemsAddress: "0xabc",
      entryTokenAddress: "0xdef",
      usernameFelt: "0x123",
      tokenId: 7n,
      cosmeticTokenIds: [],
    });

    expect(calls).toHaveLength(2);
    expect(calls[1]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "register",
      calldata: ["0x123", "7", "0"],
    });
  });

  it("serializes selected cosmetic token ids into the register calldata", () => {
    const calls = buildBlitzRegisterCalls({
      blitzSystemsAddress: "0xabc",
      entryTokenAddress: "0xdef",
      usernameFelt: "0x123",
      tokenId: 7n,
      cosmeticTokenIds: ["0x1", "0x2"],
    });

    expect(calls[1]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "register",
      calldata: ["0x123", "7", "2", "0x1", "0x2"],
    });
  });
});
