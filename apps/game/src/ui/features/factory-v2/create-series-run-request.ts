import type {
  FactoryBiomeClimateOverrides,
  FactoryBlitzRegistrationOverrides,
  FactoryMapConfigOverrides,
} from "@bibliothecadao/types";
import type { CreateFactorySeriesRunRequest, FactoryWorkerEnvironmentId } from "./api/factory-worker";
import type {
  FactoryGameMode,
  FactoryLaunchPreset,
  FactorySeriesGameDraft,
  FactorySeriesRetryIntervalMinutes,
} from "./types";

export const buildFactoryCreateSeriesRunRequest = ({
  environmentId,
  seriesName,
  workflowRef,
  games,
  selectedMode,
  selectedPreset,
  devModeOn,
  twoPlayerMode,
  singleRealmMode,
  durationMinutes,
  showsDuration,
  mapConfigOverrides,
  biomeClimateOverrides,
  blitzRegistrationOverrides,
  autoRetryIntervalMinutes,
  resolveStartTime,
}: {
  environmentId: FactoryWorkerEnvironmentId;
  seriesName: string;
  workflowRef?: string;
  games: FactorySeriesGameDraft[];
  selectedMode: FactoryGameMode;
  selectedPreset: FactoryLaunchPreset | null;
  devModeOn: boolean;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  durationMinutes: number | null;
  showsDuration: boolean;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  biomeClimateOverrides?: FactoryBiomeClimateOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  resolveStartTime: (startAt: string) => string;
}): CreateFactorySeriesRunRequest => ({
  environment: environmentId,
  seriesName,
  workflowRef,
  games: games.map((game) => ({
    gameName: game.gameName,
    startTime: resolveStartTime(game.startAt),
    seriesGameNumber: game.seriesGameNumber,
    biomeClimateOverrides: game.biomeClimateOverrides ?? biomeClimateOverrides,
  })),
  devModeOn,
  twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
  singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
  durationSeconds: showsDuration && durationMinutes ? durationMinutes * 60 : undefined,
  mapConfigOverrides,
  biomeClimateOverrides,
  blitzRegistrationOverrides: selectedMode === "blitz" ? blitzRegistrationOverrides : undefined,
  autoRetryIntervalMinutes,
});
