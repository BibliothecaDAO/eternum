import type { ConfigurationNetwork } from "../shared/game-environments";

import type { GameType } from "../source/common/types";
export type { GameType };

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "../source/build-config";

// Replacer for JSON.stringify that converts BigInt values to strings.
function bigIntReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export async function saveResolvedConfigJson(chain: ConfigurationNetwork, gameType: GameType) {
  const configurationJson = await buildConfig({
    chain,
    gameType,
  });

  const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../generated");
  const targetPath = `${dataDir}/${gameType}.${chain}.json`;

  const jsonFileContent = `{
      "generatedFromTsFile": true,
      "message": "This file was generated from the composed config source and should not be edited manually",
      "configuration": ${JSON.stringify(configurationJson, bigIntReplacer, 2)}
    }`;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, jsonFileContent);
  fs.renameSync(tmpPath, targetPath);
}

export function logNetwork(network: ConfigurationNetwork): void {
  console.log(`Configuration profile: ${network}`);
}
