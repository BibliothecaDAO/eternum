import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";
import type { CreateFactoryRunRequest, FactoryWorkerEnvironmentId } from "./api/factory-worker";
import type { FactoryGameMode, FactoryLaunchPreset } from "./types";

export const buildFactoryCreateRunRequest = ({
  environmentId,
  gameName,
  gameStartTime,
  workflowRef,
  selectedMode,
  selectedPreset,
  twoPlayerMode,
  singleRealmMode,
  durationMinutes,
  showsDuration,
  mapConfigOverrides,
  blitzRegistrationOverrides,
}: {
  environmentId: FactoryWorkerEnvironmentId;
  gameName: string;
  gameStartTime: string;
  workflowRef?: string;
  selectedMode: FactoryGameMode;
  selectedPreset: FactoryLaunchPreset | null;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  durationMinutes: number | null;
  showsDuration: boolean;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
}): CreateFactoryRunRequest => ({
  environment: environmentId,
  gameName,
  gameStartTime,
  workflowRef,
  devModeOn: selectedPreset?.defaults.devMode ?? false,
  twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
  singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
  durationSeconds: showsDuration && durationMinutes ? durationMinutes * 60 : undefined,
  mapConfigOverrides,
  blitzRegistrationOverrides: selectedMode === "blitz" ? blitzRegistrationOverrides : undefined,
});
