import * as path from "node:path";
import * as fs from "node:fs";
import { ensureRepoDirectory, resolveRepoPath, writeRepoJsonFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import type { LaunchGameSummary } from "../types";

export function resolveLaunchSummaryRelativePath(environmentId: LaunchGameSummary["environment"], gameName: string): string {
  const filename = `${toSafeSlug(environmentId)}-${toSafeSlug(gameName)}.json`;
  return path.join(".context/game-launch", filename);
}

export function loadLaunchSummaryIfPresent(
  environmentId: LaunchGameSummary["environment"],
  gameName: string,
): LaunchGameSummary | null {
  const relativePath = resolveLaunchSummaryRelativePath(environmentId, gameName);
  const absolutePath = resolveRepoPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as LaunchGameSummary;
}

export function writeLaunchSummary(summary: LaunchGameSummary): string {
  ensureRepoDirectory(".context/game-launch");
  return writeRepoJsonFile(resolveLaunchSummaryRelativePath(summary.environment, summary.gameName), summary);
}
