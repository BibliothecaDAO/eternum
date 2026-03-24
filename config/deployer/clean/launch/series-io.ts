import * as fs from "node:fs";
import * as path from "node:path";
import { ensureRepoDirectory, resolveRepoPath, writeRepoJsonFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import type { LaunchSeriesSummary } from "../types";

export function resolveSeriesLaunchSummaryRelativePath(
  environmentId: LaunchSeriesSummary["environment"],
  seriesName: string,
): string {
  const filename = `series-${toSafeSlug(environmentId)}-${toSafeSlug(seriesName)}.json`;
  return path.join(".context/game-launch", filename);
}

export function loadSeriesLaunchSummaryIfPresent(
  environmentId: LaunchSeriesSummary["environment"],
  seriesName: string,
): LaunchSeriesSummary | null {
  const relativePath = resolveSeriesLaunchSummaryRelativePath(environmentId, seriesName);
  const absolutePath = resolveRepoPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as LaunchSeriesSummary;
}

export function writeSeriesLaunchSummary(summary: LaunchSeriesSummary): string {
  ensureRepoDirectory(".context/game-launch");
  return writeRepoJsonFile(resolveSeriesLaunchSummaryRelativePath(summary.environment, summary.seriesName), summary);
}
