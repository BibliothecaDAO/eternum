import * as fs from "node:fs";
import { resolveRepoPath } from "./repo";

export function resolveCommonAddressesPath(chain: string): string {
  const candidates = [`contracts/common/addresses/${chain}.json`, `contracts/addresses/common/${chain}.json`];
  for (const candidate of candidates) {
    if (fs.existsSync(resolveRepoPath(candidate))) return candidate;
  }
  throw new Error(`Could not find common addresses file for chain "${chain}"`);
}
