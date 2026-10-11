import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { dirname, resolve } from "node:path";
export { now } from "./clock";
export function load<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8"));
}
export function save(file: string, data: unknown): void {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, JSON.stringify(data, null, 2));
  renameSync(temporary, file);
}
export function percentile(values: number[], p: number): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]! : null;
}
