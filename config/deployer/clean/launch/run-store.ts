import type { LaunchGameSummary, LaunchRotationSummary, LaunchSeriesSummary } from "../types";
import { loadLaunchSummaryIfPresent, writeLaunchSummary } from "./io";
import { loadRotationLaunchSummaryIfPresent, writeRotationLaunchSummary } from "./rotation-io";
import { loadSeriesLaunchSummaryIfPresent, writeSeriesLaunchSummary } from "./series-io";

export interface LaunchRunStore {
  loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null>;
  saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary>;
  loadSeries(environment: LaunchSeriesSummary["environment"], seriesName: string): Promise<LaunchSeriesSummary | null>;
  saveSeries(summary: LaunchSeriesSummary): Promise<LaunchSeriesSummary>;
  loadRotation(
    environment: LaunchRotationSummary["environment"],
    rotationName: string,
  ): Promise<LaunchRotationSummary | null>;
  saveRotation(summary: LaunchRotationSummary): Promise<LaunchRotationSummary>;
}

export const fileLaunchRunStore: LaunchRunStore = {
  loadGame: async (environment, gameName) => loadLaunchSummaryIfPresent(environment, gameName),
  saveGame: async (summary) => ({ ...summary, outputPath: writeLaunchSummary(summary) }),
  loadSeries: async (environment, seriesName) => loadSeriesLaunchSummaryIfPresent(environment, seriesName),
  saveSeries: async (summary) => ({ ...summary, outputPath: writeSeriesLaunchSummary(summary) }),
  loadRotation: async (environment, rotationName) => loadRotationLaunchSummaryIfPresent(environment, rotationName),
  saveRotation: async (summary) => ({ ...summary, outputPath: writeRotationLaunchSummary(summary) }),
};
