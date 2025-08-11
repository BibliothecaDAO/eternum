export type NetworkType = "local" | "sepolia" | "slot" | "slottest" | "mainnet";

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
    slottest: {
      colors: {
        primary: "\x1b[38;5;183m",
        secondary: "\x1b[38;5;219m",
      },
      emoji: "⚡",
      label: "SLOTTEST Network",
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
