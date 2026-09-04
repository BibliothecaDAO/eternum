import * as fs from "node:fs";
import { resolveRepoPath } from "./repo";

export function resolveCommonAddressesPath(chain: string): string {
  const addressPath = `contracts/common/addresses/${chain}.json`;
  if (fs.existsSync(resolveRepoPath(addressPath))) return addressPath;
  throw new Error(`Could not find common addresses file for chain "${chain}"`);
}
