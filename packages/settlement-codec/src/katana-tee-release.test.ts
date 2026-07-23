import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import {
  assertKatanaTeeReleaseProjection,
  getKatanaTeeReleaseIdentity,
  getKatanaTeeReleaseProjection,
  KATANA_TEE_RELEASE_MANIFEST_SHA256,
  matchesKatanaTeeAttestationMeasurement,
  matchesKatanaTeeReleaseProjection,
  validateKatanaTeeReleaseIdentity,
} from "./katana-tee-release";

describe("public Katana TEE release identity", () => {
  test("binds the checked manifest hash and runtime projection to the verified public release source", () => {
    const manifest = readFileSync(new URL("../schema/katana-tee-release-v1.json", import.meta.url));
    const identity = getKatanaTeeReleaseIdentity();
    const projection = getKatanaTeeReleaseProjection();

    expect(createHash("sha256").update(manifest).digest("hex")).toBe(KATANA_TEE_RELEASE_MANIFEST_SHA256);
    expect(identity.source.githubVerification).toMatchObject({ verified: true, reason: "valid" });
    expect(identity.measuredComponents).toHaveProperty("katana");
    expect(identity.assets).toHaveLength(3);
    expect(projection).toEqual({
      releaseIdentitySha256: KATANA_TEE_RELEASE_MANIFEST_SHA256,
      releaseTag: "tee-vm-v0.4.1+katana-v1.8.0-rc.9",
      sourceCommit: "92787269bc05ab319f566b5d1f85715cb408fc17",
      buildInfoDigest: "sha256:6edb4e541824f2e6fbfe16beb180e6fc2ace7c167b618bbe289d676b0988b66f",
      vmAssetDigest: "sha256:7a518422e8fbb5517b36f230a4dd3fa55f880969b6f51f5f41815549414b8767",
      launchMeasurement:
        "68c29fbdbf424f9fd14b1bc393f366d0b3d4330cb5e75c875822a595840aea334770a5b015d6ece90a35f57739d7f16e",
    });
    expect(() => validateKatanaTeeReleaseIdentity(identity)).not.toThrow();
  });

  test("exposes one canonical runtime release and attestation guard", () => {
    const projection = getKatanaTeeReleaseProjection();
    const measurement = `sha384:${projection.launchMeasurement}`;

    expect(matchesKatanaTeeReleaseProjection(projection)).toBe(true);
    expect(matchesKatanaTeeAttestationMeasurement(measurement)).toBe(true);
    expect(() => assertKatanaTeeReleaseProjection(projection, "Game stack release")).not.toThrow();
    expect(matchesKatanaTeeReleaseProjection({ ...projection, sourceCommit: "0".repeat(40) })).toBe(false);
    expect(matchesKatanaTeeAttestationMeasurement(`sha384:${"0".repeat(96)}`)).toBe(false);
    expect(() =>
      assertKatanaTeeReleaseProjection(
        { ...projection, vmAssetDigest: `sha256:${"0".repeat(64)}` },
        "Game stack release",
      ),
    ).toThrow("Game stack release does not match the pinned public release");
  });

  test("fails closed when any required release manifest field is substituted", () => {
    const substitutions: Array<(identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => void> = [
      (identity) => {
        identity.schemaVersion = 2;
      },
      (identity) => {
        identity.repository = "https://attacker.invalid/katana";
      },
      (identity) => {
        identity.release.tag = "substituted";
      },
      (identity) => {
        identity.release.url = "https://attacker.invalid/release";
      },
      (identity) => {
        identity.release.publishedAt = "2026-07-21T00:00:00Z";
      },
      (identity) => {
        identity.source.commit = "0".repeat(40);
      },
      (identity) => {
        identity.source.tree = "0".repeat(40);
      },
      (identity) => {
        identity.source.url = "https://attacker.invalid/commit";
      },
      (identity) => {
        identity.source.buildSubtree.path = "misc/substituted";
      },
      (identity) => {
        identity.source.buildSubtree.tree = "0".repeat(40);
      },
      (identity) => {
        identity.source.githubVerification.verified = false;
      },
      (identity) => {
        identity.source.githubVerification.reason = "unsigned";
      },
      (identity) => {
        identity.source.githubVerification.verifiedAt = "2026-07-21T00:00:00Z";
      },
      ...[0, 1, 2].flatMap((assetIndex) => [
        (identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => {
          identity.assets[assetIndex].name = "substituted";
        },
        (identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => {
          identity.assets[assetIndex].mediaType = "application/octet-stream";
        },
        (identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => {
          identity.assets[assetIndex].size += 1;
        },
        (identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => {
          identity.assets[assetIndex].digest = `sha256:${"0".repeat(64)}`;
        },
      ]),
      (identity) => {
        identity.launchMeasurement.algorithm = "sha256";
      },
      (identity) => {
        identity.launchMeasurement.value = "0".repeat(96);
      },
      ...(["ovmf", "kernel", "initrd", "katana", "paymaster", "vrf"] as const).map(
        (component) => (identity: ReturnType<typeof getKatanaTeeReleaseIdentity>) => {
          identity.measuredComponents[component] = "0".repeat(64);
        },
      ),
      (identity) => {
        identity.buildInputs.ovmfCommit = "0".repeat(40);
      },
      (identity) => {
        identity.buildInputs.luksUuid = "11111111-1111-1111-1111-111111111111";
      },
      (identity) => {
        identity.assets.reverse();
      },
      (identity) => {
        delete (identity.release as Partial<typeof identity.release>).url;
      },
      (identity) => {
        Object.assign(identity, { unexpected: true });
      },
    ];

    for (const substitute of substitutions) {
      const substituted = getKatanaTeeReleaseIdentity();
      substitute(substituted);
      expect(() => validateKatanaTeeReleaseIdentity(substituted)).toThrow(/Katana TEE release identity mismatch/);
    }
  });
});
