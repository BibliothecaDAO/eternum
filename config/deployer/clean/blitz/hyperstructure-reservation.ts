import { getContractByName, NAMESPACE } from "@bibliothecadao/provider";
import type { Config as EternumConfig } from "@bibliothecadao/types";
import { CallData, type Call } from "starknet";
import type { GameManifestLike } from "../shared/manifest-types";

export const BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE = 19;
export const BLITZ_HYPERSTRUCTURE_RESERVATION_COOLDOWN_MS = 10_000;

function resolveRegistrationCountMax(config: EternumConfig): number {
  return Number(config.blitz?.registration?.registration_count_max ?? 0);
}

function resolveBlitzHyperstructureReservationTarget(config: EternumConfig): number {
  const registrationCountMax = resolveRegistrationCountMax(config);
  if (registrationCountMax <= 0) {
    return 0;
  }

  if (config.settlement?.two_player_mode) {
    return 3;
  }

  let maxRingCount = 0;

  while (registrationCountMax >= 6 * maxRingCount * maxRingCount + 1) {
    maxRingCount += 1;
  }

  return 1 + 3 * maxRingCount * (maxRingCount + 1);
}

export function shouldReserveBlitzHyperstructures(config: EternumConfig): boolean {
  return Boolean(config.blitz?.mode?.on) && resolveBlitzHyperstructureReservationTarget(config) > 0;
}

export function resolveBlitzHyperstructureReservationCallCount(config: EternumConfig): number {
  const target = resolveBlitzHyperstructureReservationTarget(config);
  if (target <= 0) {
    return 0;
  }

  return Math.ceil(target / BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE);
}

export function buildReserveBlitzHyperstructuresCall(manifest: GameManifestLike): Call {
  return {
    contractAddress: getContractByName(manifest as any, `${NAMESPACE}-hyperstructure_create_systems`),
    entrypoint: "reserve_hyperstructures",
    calldata: CallData.compile([BLITZ_HYPERSTRUCTURE_RESERVATION_BATCH_SIZE]),
  };
}
