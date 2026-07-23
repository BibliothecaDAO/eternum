import katanaTeeReleaseJson from "../schema/katana-tee-release-v1.json";

export interface KatanaTeeReleaseAsset {
  name: string;
  mediaType: string;
  size: number;
  digest: string;
}

export interface KatanaTeeReleaseIdentity {
  schemaVersion: number;
  repository: string;
  release: {
    tag: string;
    url: string;
    publishedAt: string;
  };
  source: {
    commit: string;
    tree: string;
    url: string;
    buildSubtree: {
      path: string;
      tree: string;
    };
    githubVerification: {
      verified: boolean;
      reason: string;
      verifiedAt: string;
    };
  };
  assets: KatanaTeeReleaseAsset[];
  launchMeasurement: {
    algorithm: string;
    value: string;
  };
  measuredComponents: {
    ovmf: string;
    kernel: string;
    initrd: string;
    katana: string;
    paymaster: string;
    vrf: string;
  };
  buildInputs: {
    ovmfCommit: string;
    luksUuid: string;
  };
}

export interface KatanaTeeReleaseProjection {
  releaseIdentitySha256: string;
  releaseTag: string;
  sourceCommit: string;
  buildInfoDigest: string;
  vmAssetDigest: string;
  launchMeasurement: string;
}

export const KATANA_TEE_RELEASE_MANIFEST_SHA256 = "184822d44db5bb9e0f6652a2a7cf7b851ac9a65eaa76bb991d642679fbb7dbf2";

const RELEASE_IDENTITY = katanaTeeReleaseJson as KatanaTeeReleaseIdentity;
const RELEASE_PROJECTION_FIELDS = [
  "releaseIdentitySha256",
  "releaseTag",
  "sourceCommit",
  "buildInfoDigest",
  "vmAssetDigest",
  "launchMeasurement",
] as const satisfies readonly (keyof KatanaTeeReleaseProjection)[];

export function getKatanaTeeReleaseIdentity(): KatanaTeeReleaseIdentity {
  return structuredClone(RELEASE_IDENTITY);
}

export function getKatanaTeeReleaseProjection(): KatanaTeeReleaseProjection {
  const identity = getKatanaTeeReleaseIdentity();
  validateKatanaTeeReleaseIdentity(identity);

  return {
    releaseIdentitySha256: KATANA_TEE_RELEASE_MANIFEST_SHA256,
    releaseTag: identity.release.tag,
    sourceCommit: identity.source.commit,
    buildInfoDigest: requireReleaseAsset(identity, "build-info-").digest,
    vmAssetDigest: requireReleaseAsset(identity, "katana-tee-vm-").digest,
    launchMeasurement: identity.launchMeasurement.value,
  };
}

export function validateKatanaTeeReleaseIdentity(identity: KatanaTeeReleaseIdentity): void {
  if (JSON.stringify(identity) !== JSON.stringify(RELEASE_IDENTITY)) {
    throw new Error("Katana TEE release identity mismatch");
  }
}

export function matchesKatanaTeeReleaseProjection(value: unknown): value is KatanaTeeReleaseProjection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<Record<keyof KatanaTeeReleaseProjection, unknown>>;
  const expected = getKatanaTeeReleaseProjection();
  return RELEASE_PROJECTION_FIELDS.every((field) => candidate[field] === expected[field]);
}

export function assertKatanaTeeReleaseProjection(
  value: unknown,
  label = "Katana TEE release",
): asserts value is KatanaTeeReleaseProjection {
  if (!matchesKatanaTeeReleaseProjection(value)) {
    throw new Error(`${label} does not match the pinned public release`);
  }
}

export function matchesKatanaTeeAttestationMeasurement(value: unknown): value is string {
  return value === `sha384:${getKatanaTeeReleaseProjection().launchMeasurement}`;
}

function requireReleaseAsset(identity: KatanaTeeReleaseIdentity, namePrefix: string): KatanaTeeReleaseAsset {
  const assets = identity.assets.filter(({ name }) => name.startsWith(namePrefix));
  if (assets.length !== 1) {
    throw new Error(`Katana TEE release identity requires exactly one ${namePrefix} asset`);
  }
  return assets[0];
}
