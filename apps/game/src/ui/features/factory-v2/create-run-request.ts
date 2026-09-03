import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { CreateFactoryRunRequest, FactoryWorkerEnvironmentId } from "./api/factory-worker";
import { resolveLaunchDevModeOn } from "./launch-dev-mode";
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
  biomeClimateOverrides,
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
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
}): CreateFactoryRunRequest => ({
  environment: environmentId,
  gameName,
  gameStartTime,
  workflowRef,
  // Registered registrar preset the launch runs on (appchain).
  version: selectedPreset?.defaults.version,
  devModeOn: resolveLaunchDevModeOn(selectedPreset),
  twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
  singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
  durationSeconds: showsDuration && durationMinutes ? durationMinutes * 60 : undefined,
  mapConfigOverrides,
  biomeClimateOverrides,
  blitzRegistrationOverrides: selectedMode === "blitz" ? blitzRegistrationOverrides : undefined,
});
