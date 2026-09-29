import type { LaunchGameSummary } from "../types";
import { loadLaunchSummaryIfPresent, writeLaunchSummary } from "./io";

export interface LaunchRunStore {
  loadGame(environment: LaunchGameSummary["environment"], gameName: string): Promise<LaunchGameSummary | null>;
  saveGame(summary: LaunchGameSummary): Promise<LaunchGameSummary>;
}

export const fileLaunchRunStore: LaunchRunStore = {
  loadGame: async (environment, gameName) => loadLaunchSummaryIfPresent(environment, gameName),
  saveGame: async (summary) => ({ ...summary, outputPath: writeLaunchSummary(summary) }),
};
