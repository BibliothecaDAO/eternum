import type { Config } from "@bibliothecadao/eternum";
export type NetworkType = "local" | "sepolia" | "slot" | "mainnet";
/**
 * Loads the environment-specific configuration based on the network type.
 *
 * @async
 * @remarks
 * Configuration files must follow these naming conventions:
 * - Located in environments/ directory
 * - Named exactly as the NetworkType: local.ts, sepolia.ts, slot.ts, mainnet.ts
 * - Must export a default Config object
 *
 * @throws {Error} If the configuration file cannot be loaded
 *
 * @example
 * ```typescript
 * const config = await getConfigFromNetwork('local'); // loads from environments/local.ts
 * ```
 */
export async function getConfigFromNetwork(chain: NetworkType): Promise<Config> {
  const CONFIGURATION_FILE = `../environments/data/${chain}.json`;
  try {
    const configurationJson = (await import(CONFIGURATION_FILE)).default;
    return configurationJson.configuration;
  } catch (error) {
    throw new Error(`Failed to load configuration for chain ${chain}: ${error}`);
  }
}

export async function saveConfigJsonFromConfigTsFile(chain: NetworkType) {
  const fs = require("fs");
  const CONFIGURATION_FILE = `../environments/${chain}`;
  const configurationJson = (await import(CONFIGURATION_FILE)).default;

  // Add a replacer function to handle BigInt
  const bigIntReplacer = (key: string, value: any) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };

  // make or overwrite the json file
  const jsonFileContent = `{
      "generatedFromTsFile": true,
      "message": "This file was generated from the .ts file and should not be edited manually",
      "configuration": ${JSON.stringify(configurationJson, bigIntReplacer, 2)}
    }`;

  const dataDir = "./environments/data";
  // make the directory if it doesn't exist
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(`${dataDir}/${chain}.json`, jsonFileContent);
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
export function logNetwork(network: NetworkType): void {
  interface NetworkStyle {
    colors: {
      primary: string;
      secondary: string;
    };
    emoji: string;
    label: string;
  }

  const NETWORK_STYLES: Record<NetworkType, NetworkStyle> = {
    local: {
      colors: {
        primary: "\x1b[38;5;83m",
        secondary: "\x1b[38;5;156m",
      },
      emoji: "🌿",
      label: "LOCAL DEVELOPMENT",
    },
    sepolia: {
      colors: {
        primary: "\x1b[38;5;69m",
        secondary: "\x1b[38;5;147m",
      },
      emoji: "💫",
      label: "SEPOLIA TESTNET",
    },
    slot: {
      colors: {
        primary: "\x1b[38;5;183m",
        secondary: "\x1b[38;5;219m",
      },
      emoji: "⚡",
      label: "SLOT NETWORK",
    },
    mainnet: {
      colors: {
        primary: "\x1b[38;5;196m",
        secondary: "\x1b[38;5;203m",
      },
      emoji: "⚠️",
      label: "MAINNET LIVE",
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
