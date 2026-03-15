import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { LaunchGameSummary } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../");

function toSafeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function writeLaunchSummary(summary: LaunchGameSummary): string {
  const outputDir = path.resolve(repoRoot, ".context/game-launch");
  fs.mkdirSync(outputDir, { recursive: true });

  const filename = `${toSafeSlug(summary.environment)}-${toSafeSlug(summary.gameName)}.json`;
  const outputPath = path.resolve(outputDir, filename);
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
  return outputPath;
}
