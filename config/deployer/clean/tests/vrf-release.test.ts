import { describe, expect, test } from "bun:test";
import { CARTRIDGE_VRF_RELEASE, resolveLaunchVrfProvider } from "../vrf/release";

describe("Cartridge VRF release guard", () => {
  test("pins the reviewed source, class, and provider identities", () => {
    expect(CARTRIDGE_VRF_RELEASE).toMatchObject({
      release: "v0.3.1",
      sourceRevision: "6d1c0f60a53558f19618b2bff81c3da0849db270",
      providerClassHash: "0x00be3edf412dd5982aa102524c0b8a0bcee584c5a627ed1db6a7c36922047257",
      providerAddress: "0x051fea4450da9d6aee758bdeba88b2f665bcbf549d2c61421aa724e9ac0ced8f",
      fulfillmentMode: "asynchronous-submit-then-consume",
      gameplayMutationOrder: "consume-before-mutate",
      fallbackPolicy: "fail-closed",
    });
  });

  test("resolves a missing or zero public Blitz provider to the pinned release", () => {
    expect(resolveLaunchVrfProvider("mainnet.blitz")).toBe(CARTRIDGE_VRF_RELEASE.providerAddress);
    expect(resolveLaunchVrfProvider("mainnet.blitz", "0x0")).toBe(CARTRIDGE_VRF_RELEASE.providerAddress);
  });

  test("rejects an unapproved public Blitz provider", () => {
    expect(() => resolveLaunchVrfProvider("mainnet.blitz", "0x123")).toThrow(
      "mainnet.blitz requires Cartridge VRF v0.3.1",
    );
  });

  test("rejects malformed provider addresses", () => {
    expect(() => resolveLaunchVrfProvider("mainnet.blitz", "not-an-address")).toThrow("Invalid VRF provider address");
  });

  test("keeps every production randomness helper fail-closed", async () => {
    const randomnessHelpers = [
      "contracts/game/src/utils/random.cairo",
      "contracts/collectibles_claim/src/utils/random.cairo",
    ];

    for (const helperPath of randomnessHelpers) {
      const source = await Bun.file(helperPath).text();
      const productionSource = source.split("#[cfg(test)]", 1)[0];
      expect(productionSource).toContain("VRF provider address must be set");
      expect(productionSource).not.toContain("transaction_hash");
    }
  });
});
