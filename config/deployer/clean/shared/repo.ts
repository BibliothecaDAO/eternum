import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const repoRoot = path.resolve(__dirname, "../../../../");

export function resolveRepoPath(relativePath: string): string {
  return path.resolve(repoRoot, relativePath);
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

export function writeRepoTextFile(relativePath: string, value: string): string {
  const outputPath = resolveRepoPath(relativePath);
  fs.writeFileSync(outputPath, `${value}\n`);
  return outputPath;
}
