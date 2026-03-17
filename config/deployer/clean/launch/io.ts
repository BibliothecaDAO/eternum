import * as path from "node:path";
import { ensureRepoDirectory, writeRepoJsonFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import type { LaunchGameSummary } from "../types";

export function writeLaunchSummary(summary: LaunchGameSummary): string {
  ensureRepoDirectory(".context/game-launch");
  const filename = `${toSafeSlug(summary.environment)}-${toSafeSlug(summary.gameName)}.json`;
  return writeRepoJsonFile(path.join(".context/game-launch", filename), summary);
}
