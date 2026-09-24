import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// Resolved on use, not at import: modules that never touch the repository (the launch Worker) import this file too, and
// a Worker has no file URL.
export function resolveRepoPath(relativePath: string): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../", relativePath);
}

export function ensureRepoDirectory(relativePath: string): string {
  const directoryPath = resolveRepoPath(relativePath);
  fs.mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

export function loadRepoJsonFile<T>(relativePath: string): T {
  const raw = fs.readFileSync(resolveRepoPath(relativePath), "utf8");
  return JSON.parse(raw) as T;
}

export function writeRepoJsonFile(relativePath: string, value: unknown): string {
  const outputPath = resolveRepoPath(relativePath);
  fs.writeFileSync(outputPath, `${JSON.stringify(value, null, 2)}\n`);
  return outputPath;
}
