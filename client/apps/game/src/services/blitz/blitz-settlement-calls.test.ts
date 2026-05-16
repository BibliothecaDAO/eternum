// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveBlitzGrantStartingTroops: vi.fn(() => true),
}));

vi.mock("./blitz-settlement-options", () => ({
  resolveBlitzGrantStartingTroops: mocks.resolveBlitzGrantStartingTroops,
}));

import { buildBlitzSettleCalls } from "./blitz-settlement-calls";

describe("buildBlitzSettleCalls", () => {
  beforeEach(() => {
    mocks.resolveBlitzGrantStartingTroops.mockReset();
    mocks.resolveBlitzGrantStartingTroops.mockReturnValue(true);
  });

  it("emits an explicit empty cosmetic span when no cosmetics are selected", () => {
    const calls = buildBlitzSettleCalls({
      blitzSystemsAddress: "0xabc",
      signerAddress: "0x456",
      usernameFelt: "0x123",
      cosmeticTokenIds: [],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "settle",
      calldata: ["291", "1", "0", "1"],
    });
  });

  it("prepends request_random when a VRF provider is configured", () => {
    const calls = buildBlitzSettleCalls({
      blitzSystemsAddress: "0xabc",
      signerAddress: "0x456",
      usernameFelt: "0x123",
      vrfProviderAddress: "0x999",
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      contractAddress: "0x999",
      entrypoint: "request_random",
      calldata: ["2748", "0", "1110"],
    });
    expect(calls[1]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "settle",
    });
  });

  it("prepends fee approval when the world charges a registration token fee", () => {
    const calls = buildBlitzSettleCalls({
      blitzSystemsAddress: "0xabc",
      signerAddress: "0x456",
      usernameFelt: "0x123",
      entryTokenAddress: "0xentry",
      feeTokenAddress: "0xfee",
      feeAmount: 9n,
    });

    expect(calls).toHaveLength(4);
    expect(calls[0]).toMatchObject({
      contractAddress: "0xfee",
      entrypoint: "approve",
    });
    expect(calls[1]).toMatchObject({
      contractAddress: "0xentry",
      entrypoint: "set_approval_for_all",
    });
    expect(calls[2]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "settle",
    });
    expect(calls[3]).toMatchObject({
      contractAddress: "0xentry",
      entrypoint: "set_approval_for_all",
    });
  });

  it("serializes selected cosmetic token ids into the settle calldata", () => {
    const calls = buildBlitzSettleCalls({
      blitzSystemsAddress: "0xabc",
      signerAddress: "0x456",
      usernameFelt: "0x123",
      cosmeticTokenIds: ["0x1", "0x2"],
    });

    expect(calls[0]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "settle",
      calldata: ["291", "1", "2", "1", "2", "1"],
    });
  });

  it("appends a disabled troop grant flag when the dev override turns it off", () => {
    mocks.resolveBlitzGrantStartingTroops.mockReturnValue(false);

    const calls = buildBlitzSettleCalls({
      blitzSystemsAddress: "0xabc",
      signerAddress: "0x456",
      usernameFelt: "0x123",
    });

    expect(calls[0]).toMatchObject({
      contractAddress: "0xabc",
      entrypoint: "settle",
      calldata: ["291", "1", "0", "0"],
    });
  });

  it("fails fast when a fee-gated blitz world is missing its entry token collection", () => {
    expect(() =>
      buildBlitzSettleCalls({
        blitzSystemsAddress: "0xabc",
        signerAddress: "0x456",
        usernameFelt: "0x123",
        feeTokenAddress: "0xfee",
        feeAmount: 9n,
      }),
    ).toThrow("Blitz worlds with entry fees must define an entry token collection");
  });
});
