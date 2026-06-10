import { describe, expect, test } from "bun:test";
import {
  buildBlitzEntryTokenDeployCalldata,
  resolveBlitzEntryTokenAddress,
  shouldDeployBlitzEntryToken,
} from "../blitz/entry-token";

const manifest = {
  contracts: [
    { tag: "s1_eternum-blitz_realm_systems", address: "0x111" },
    { tag: "s1_eternum-config_systems", address: "0x222" },
  ],
};

describe("blitz entry token helpers", () => {
  test("detects when blitz registration will deploy an entry token", () => {
    expect(
      shouldDeployBlitzEntryToken({
        blitz: {
          mode: { on: true },
          registration: { fee_amount: "1" },
        },
      } as any),
    ).toBe(true);

    expect(
      shouldDeployBlitzEntryToken({
        blitz: {
          mode: { on: true },
          registration: { fee_amount: "0" },
        },
      } as any),
    ).toBe(false);
  });

  test("builds the shared deploy calldata from the patched manifest", () => {
    expect(buildBlitzEntryTokenDeployCalldata(manifest as any)).toEqual([
      "0x0",
      "0x5265616c6d733a204c6f6f74204368657374",
      "0x12",
      "0x0",
      "0x524c43",
      "0x3",
      "0x0",
      "0x0",
      "0x0",
      "0x0",
      "0x4c6f6f7420436865737420666f72205265616c6d73",
      "0x15",
      "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
      "0x111",
      "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
      "0x222",
      "0x222",
      "0x992acf50dba66f87d8cafffbbc3cdbbec5f8f514b5014f6d4d75e6b8789153",
      "0x1f4",
    ]);
  });

  test("recomputes the deterministic legacy UDC entry token address", () => {
    expect(
      resolveBlitzEntryTokenAddress({
        manifest: manifest as any,
        entryTokenClassHash: "0x123",
        blitzRegistrationTransactionHash: "0xabc",
      }),
    ).toBe("0x55587061e1f470c749e9f7e568a3eb8b8d2335ac2c9b5adf8d9669fb378b38");
  });
});
