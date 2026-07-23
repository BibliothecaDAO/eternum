import {
  assertKatanaTeeReleaseProjection,
  getKatanaTeeReleaseProjection,
  matchesKatanaTeeAttestationMeasurement,
  type KatanaTeeReleaseProjection,
} from "@bibliothecadao/settlement-codec";
import { AwsRuntimeOperationalError } from "./errors";

export type AwsKatanaTeeReleaseIdentity = KatanaTeeReleaseProjection;

export const PINNED_KATANA_TEE_RELEASE = Object.freeze(getKatanaTeeReleaseProjection());

export function validatePinnedKatanaTeeRelease(
  release: AwsKatanaTeeReleaseIdentity | undefined,
  attestationMeasurement: string | undefined,
  runtimeLabel = "Production Blitz Katana",
): void {
  if (!release) {
    throw new AwsRuntimeOperationalError("runtime-validation", `${runtimeLabel} requires katanaTeeRelease identity`);
  }

  try {
    assertKatanaTeeReleaseProjection(release, `${runtimeLabel} katanaTeeRelease`);
  } catch (error) {
    throw new AwsRuntimeOperationalError("runtime-validation", error instanceof Error ? error.message : String(error));
  }

  if (!matchesKatanaTeeAttestationMeasurement(attestationMeasurement)) {
    throw new AwsRuntimeOperationalError(
      "runtime-validation",
      `${runtimeLabel} attestationMeasurement does not match the pinned public release launch measurement`,
    );
  }
}
