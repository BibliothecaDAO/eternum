import { describe, expect, test } from "vitest";
import {
  hashKatanaLaunchAttestationBindingV1,
  type KatanaLaunchAttestationBindingV1,
} from "./katana-launch-attestation";

const REFERENCE_BINDING: KatanaLaunchAttestationBindingV1 = {
  gameStackId: "blitz-season-42",
  deploymentId: "0x4242",
  runtimeInstanceId: "9c71925b-e87d-4a26-85cf-e5476274b451",
  l3ChainId: "0x534e5f424c49545a",
  genesisHash: `0x6${"c".repeat(62)}`,
  rulesetId: "0x77",
  releaseBundleHash: "0x88",
  releaseIdentitySha256: "184822d44db5bb9e0f6652a2a7cf7b851ac9a65eaa76bb991d642679fbb7dbf2",
  vmAssetDigest: "sha256:7a518422e8fbb5517b36f230a4dd3fa55f880969b6f51f5f41815549414b8767",
};

describe("Katana launch attestation binding", () => {
  test("matches the Rust control-plane binding vector", () => {
    expect(hashKatanaLaunchAttestationBindingV1(REFERENCE_BINDING)).toBe(
      "0x06a7abad0946e574edebbcabe2402cd05bbb99c184f11c0f5fea8f689e6c6844",
    );
  });

  test("uses schema order regardless of JavaScript property insertion order", () => {
    const reordered = Object.fromEntries(Object.entries(REFERENCE_BINDING).reverse());
    expect(hashKatanaLaunchAttestationBindingV1(reordered as unknown as KatanaLaunchAttestationBindingV1)).toBe(
      "0x06a7abad0946e574edebbcabe2402cd05bbb99c184f11c0f5fea8f689e6c6844",
    );
  });

  test("rejects changed, missing, additional, and noncanonical field values", () => {
    expect(
      hashKatanaLaunchAttestationBindingV1({ ...REFERENCE_BINDING, genesisHash: `0x6${"d".repeat(62)}` }),
    ).not.toBe("0x06a7abad0946e574edebbcabe2402cd05bbb99c184f11c0f5fea8f689e6c6844");

    const missing = { ...REFERENCE_BINDING } as Partial<KatanaLaunchAttestationBindingV1>;
    delete missing.rulesetId;
    expect(() => hashKatanaLaunchAttestationBindingV1(missing as KatanaLaunchAttestationBindingV1)).toThrow(
      "fields are not canonical",
    );

    expect(() =>
      hashKatanaLaunchAttestationBindingV1(
        Object.assign({ ...REFERENCE_BINDING }, { unexpected: "value" }) as KatanaLaunchAttestationBindingV1,
      ),
    ).toThrow("fields are not canonical");

    for (const [field, value] of [
      ["gameStackId", "Blitz-Season-42"],
      ["deploymentId", "0x04242"],
      ["runtimeInstanceId", "9C71925B-E87D-4A26-85CF-E5476274B451"],
      ["l3ChainId", "0X534E5F424C49545A"],
      ["genesisHash", `0x${"c".repeat(64)}`],
      ["rulesetId", "0x077"],
      ["releaseBundleHash", "0x088"],
      ["releaseIdentitySha256", "A".repeat(64)],
      ["vmAssetDigest", `sha256:${"A".repeat(64)}`],
    ] as const) {
      expect(() => hashKatanaLaunchAttestationBindingV1({ ...REFERENCE_BINDING, [field]: value })).toThrow(
        `requires canonical ${field}`,
      );
    }
  });
});
