import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { CreateFactoryRotationRunRequest, FactoryWorkerEnvironmentId } from "./api/factory-worker";
import type {
  FactoryGameMode,
  FactoryLaunchPreset,
  FactoryRotationEvaluationIntervalMinutes,
  FactorySeriesRetryIntervalMinutes,
} from "./types";

export const buildFactoryCreateRotationRunRequest = ({
  environmentId,
  rotationName,
  workflowRef,
  firstGameStartTime,
  gameIntervalMinutes,
  maxGames,
  advanceWindowGames,
  evaluationIntervalMinutes,
  selectedMode,
  selectedPreset,
  twoPlayerMode,
  singleRealmMode,
  durationMinutes,
  showsDuration,
  mapConfigOverrides,
  biomeClimateOverrides,
  biomeClimateOverridesByGameNumber,
  blitzRegistrationOverrides,
  autoRetryIntervalMinutes,
  resolveStartTime,
}: {
  environmentId: FactoryWorkerEnvironmentId;
  rotationName: string;
  workflowRef?: string;
  firstGameStartTime: string;
  gameIntervalMinutes: number;
  maxGames: number;
  advanceWindowGames: number;
  evaluationIntervalMinutes: FactoryRotationEvaluationIntervalMinutes;
  selectedMode: FactoryGameMode;
  selectedPreset: FactoryLaunchPreset | null;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  durationMinutes: number | null;
  showsDuration: boolean;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  biomeClimateOverridesByGameNumber?: Record<number, FactoryBiomeClimateOverrides>;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  resolveStartTime: (startAt: string) => string;
}): CreateFactoryRotationRunRequest => ({
  environment: environmentId,
  rotationName,
  workflowRef,
  firstGameStartTime: resolveStartTime(firstGameStartTime),
  gameIntervalMinutes,
  maxGames,
  advanceWindowGames,
  evaluationIntervalMinutes,
  devModeOn: selectedPreset?.defaults.devMode ?? false,
  twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
  singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
  durationSeconds: showsDuration && durationMinutes ? durationMinutes * 60 : undefined,
  mapConfigOverrides,
  biomeClimateOverrides,
  biomeClimateOverridesByGameNumber,
  blitzRegistrationOverrides: selectedMode === "blitz" ? blitzRegistrationOverrides : undefined,
  autoRetryIntervalMinutes,
});
