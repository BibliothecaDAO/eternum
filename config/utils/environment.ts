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

const GENERATED_CONFIG_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../generated");

export const resolvedConfigPath = (chain: ConfigurationNetwork, gameType: GameType): string =>
  path.join(GENERATED_CONFIG_DIRECTORY, `${gameType}.${chain}.json`);

/** The generated config file's exact contents, composed from the config source. */
export async function renderResolvedConfigJson(chain: ConfigurationNetwork, gameType: GameType): Promise<string> {
  const configurationJson = await buildConfig({ chain, gameType });
  return `{
      "generatedFromTsFile": true,
      "message": "This file was generated from the composed config source and should not be edited manually",
      "configuration": ${JSON.stringify(configurationJson, bigIntReplacer, 2)}
    }`;
}

export async function saveResolvedConfigJson(chain: ConfigurationNetwork, gameType: GameType) {
  const targetPath = resolvedConfigPath(chain, gameType);
  fs.mkdirSync(GENERATED_CONFIG_DIRECTORY, { recursive: true });
  const tmpPath = `${targetPath}.tmp`;
  fs.writeFileSync(tmpPath, await renderResolvedConfigJson(chain, gameType));
  fs.renameSync(tmpPath, targetPath);
}
