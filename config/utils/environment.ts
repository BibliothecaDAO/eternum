export type NetworkType = "local" | "sepolia" | "slot" | "slottest" | "mainnet";

import fs from "fs";

// Replacer for JSON.stringify that converts BigInt values to strings.
function bigIntReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function extractContractAddressFromManifest(manifest: any, tag: string): string | null {
  try {
    const list = manifest?.contracts;
    if (!Array.isArray(list)) return null;
    const found = list.find((c: any) => c?.tag === tag);
    return found?.address ?? null;
  } catch {
    return null;
  }
}

export async function saveConfigJsonFromConfigTsFile(chain: NetworkType) {
  const CONFIGURATION_FILE = `../environments/${chain}`;
  const configurationJson: any = (await import(CONFIGURATION_FILE)).default;

  const dataDir = "./environments/data";
  const targetPath = `${dataDir}/${chain}.json`;

  // Compute prev_prize_distribution_address based on previous file and current manifest
  let prevSaved: string | null = null;
  let prevCurrent: string | null = null;
  try {
    if (fs.existsSync(targetPath)) {
      const prevRaw = fs.readFileSync(targetPath, "utf8");
      const prevParsed = JSON.parse(prevRaw);
      prevSaved = prevParsed?.configuration?.prev_prize_distribution_address ?? prevParsed?.prev_prize_distribution_address ?? null;
      const prevManifest = prevParsed?.configuration?.setup?.manifest ?? prevParsed?.setup?.manifest;
      prevCurrent = extractContractAddressFromManifest(prevManifest, "s1_eternum-prize_distribution_systems");
    }
  } catch {}

  const newManifest = configurationJson?.setup?.manifest;
  const newCurrent = extractContractAddressFromManifest(newManifest, "s1_eternum-prize_distribution_systems");

  const norm = (x?: string | null) => (x ? x.toLowerCase() : "");
  const clean = (x: string) => (x === "0x0" || x === "0x" ? "" : x);
  const equal = (a?: string | null, b?: string | null) => clean(norm(a)) === clean(norm(b));

  let computedPrev: string | null = null;
  if (prevCurrent) {
    computedPrev = equal(prevCurrent, newCurrent) ? prevSaved ?? null : prevCurrent;
  } else {
    computedPrev = null;
  }

  configurationJson.prev_prize_distribution_address = computedPrev;

  const jsonFileContent = `{
      "generatedFromTsFile": true,
      "message": "This file was generated from the .ts file and should not be edited manually",
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
