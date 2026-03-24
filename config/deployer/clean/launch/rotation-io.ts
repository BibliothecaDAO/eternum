import * as fs from "node:fs";
import * as path from "node:path";
import { ensureRepoDirectory, resolveRepoPath, writeRepoJsonFile } from "../shared/repo";
import { toSafeSlug } from "../shared/slug";
import type { LaunchRotationSummary } from "../types";

export function resolveRotationLaunchSummaryRelativePath(
  environmentId: LaunchRotationSummary["environment"],
  rotationName: string,
): string {
  const filename = `rotation-${toSafeSlug(environmentId)}-${toSafeSlug(rotationName)}.json`;
  return path.join(".context/game-launch", filename);
}

export function loadRotationLaunchSummaryIfPresent(
  environmentId: LaunchRotationSummary["environment"],
  rotationName: string,
): LaunchRotationSummary | null {
  const relativePath = resolveRotationLaunchSummaryRelativePath(environmentId, rotationName);
  const absolutePath = resolveRepoPath(relativePath);

  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(absolutePath, "utf8")) as LaunchRotationSummary;
}

export function writeRotationLaunchSummary(summary: LaunchRotationSummary): string {
  ensureRepoDirectory(".context/game-launch");
  return writeRepoJsonFile(
    resolveRotationLaunchSummaryRelativePath(summary.environment, summary.rotationName),
    summary,
  );
}
