import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/**
 * Parse a .env file and set process.env entries.
 * Shell environment variables always take precedence — file values
 * only fill in vars that aren't already set.
 */
export function loadEnvFile(filePath: string, override = false): void {
  if (!existsSync(filePath)) return;

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // Strip optional "export " prefix
    const stripped = line.startsWith("export ") ? line.slice(7) : line;
    const eqIdx = stripped.indexOf("=");
    if (eqIdx === -1) continue;

    const key = stripped.slice(0, eqIdx).trim();
    if (!key) continue;

    let value = stripped.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (single or double)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Only set if not already in process.env (shell wins), unless override is true
    if (override || process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Load .env files in precedence order:
 *   1. ~/.eternum-agent/.env  (global config — API keys, preferences)
 *   2. ./.env                 (CWD — dev overrides, world-specific)
 *
 * CWD values override global. Shell env vars override both.
 */
export function loadEnvFiles(): void {
  const globalEnvPath = join(homedir(), ".eternum-agent", ".env");
  const cwdEnvPath = resolve(process.cwd(), ".env");

  // Load global first (lowest priority file)
  loadEnvFile(globalEnvPath);

  // Load CWD .env second (overrides global, but not shell)
  if (cwdEnvPath !== globalEnvPath) {
    loadEnvFile(cwdEnvPath, true);
  }
}
