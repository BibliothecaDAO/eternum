import type { GameChain } from "@realms-world/chain";

export type GameType = "blitz" | "eternum";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildConfig } from "../source/build-config";

// Replacer for JSON.stringify that converts BigInt values to strings.
function bigIntReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

export async function saveResolvedConfigJson(chain: GameChain, gameType: GameType) {
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

/**
 * Displays a stylized console output indicating the current network environment.
 *
 * @remarks
 * Uses ANSI escape codes for colored console output.
 * Each network type has its own unique color scheme and emoji identifiers:
 *
 * @example
 * ```typescript
 * logNetwork('local'); // Displays green-colored local environment banner
 * ```
 */
export function logNetwork(network: GameChain): void {
  interface NetworkStyle {
    colors: {
      primary: string;
      secondary: string;
    };
    emoji: string;
    label: string;
  }

  const NETWORK_STYLES: Record<GameChain, NetworkStyle> = {
    madara: {
      colors: {
        primary: "\x1b[38;5;83m",
        secondary: "\x1b[38;5;156m",
      },
      emoji: "🌿",
      label: "MADARA LAB",
    },
    appchain: {
      colors: {
        primary: "\x1b[38;5;208m",
        secondary: "\x1b[38;5;214m",
      },
      emoji: "⛓️",
      label: "REALMS APPCHAIN (DEV)",
    },
  };

  const style = NETWORK_STYLES[network];
  const { primary, secondary } = style.colors;
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";
  const white = "\x1b[38;5;255m";

  console.log(`
    ${primary}┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃                                            ┃
    ┃  ${secondary}╭──────────── ENVIRONMENT ────────────╮${primary}  ┃
    ┃  ${secondary}│    ${bold}${white}${style.emoji} ${style.label} ${style.emoji}${reset}${secondary}     │${primary}  ┃
    ┃  ${secondary}╰─────────────────────────────────────╯${primary}  ┃
    ┃                                            ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛${reset}`);
  console.log("\n\n");
}
