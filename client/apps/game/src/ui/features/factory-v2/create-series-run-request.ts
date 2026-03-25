import type { FactoryBlitzRegistrationOverrides, FactoryMapConfigOverrides } from "@bibliothecadao/types";
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
  games,
  selectedMode,
  selectedPreset,
  twoPlayerMode,
  singleRealmMode,
  durationMinutes,
  showsDuration,
  mapConfigOverrides,
  blitzRegistrationOverrides,
  autoRetryIntervalMinutes,
  resolveStartTime,
}: {
  environmentId: FactoryWorkerEnvironmentId;
  seriesName: string;
  games: FactorySeriesGameDraft[];
  selectedMode: FactoryGameMode;
  selectedPreset: FactoryLaunchPreset | null;
  twoPlayerMode: boolean;
  singleRealmMode: boolean;
  durationMinutes: number | null;
  showsDuration: boolean;
  mapConfigOverrides?: FactoryMapConfigOverrides;
  blitzRegistrationOverrides?: FactoryBlitzRegistrationOverrides;
  autoRetryIntervalMinutes: FactorySeriesRetryIntervalMinutes;
  resolveStartTime: (startAt: string) => string;
}): CreateFactorySeriesRunRequest => ({
  environment: environmentId,
  seriesName,
  games: games.map((game) => ({
    gameName: game.gameName,
    startTime: resolveStartTime(game.startAt),
    seriesGameNumber: game.seriesGameNumber,
  })),
  devModeOn: selectedPreset?.defaults.devMode ?? false,
  twoPlayerMode: selectedMode === "blitz" ? twoPlayerMode : false,
  singleRealmMode: selectedMode === "blitz" ? singleRealmMode : false,
  durationSeconds: showsDuration && durationMinutes ? durationMinutes * 60 : undefined,
  mapConfigOverrides,
  blitzRegistrationOverrides: selectedMode === "blitz" ? blitzRegistrationOverrides : undefined,
  autoRetryIntervalMinutes,
});
