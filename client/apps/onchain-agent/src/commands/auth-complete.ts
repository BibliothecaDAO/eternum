import path from "node:path";
import { loadConfig } from "../config";
import { readArtifacts, updateAuthStatus } from "../session/artifacts";
import { storeSessionFromCallback } from "../session";

interface AuthCompleteOptions {
  world?: string;
  sessionData?: string;
  redirectUrl?: string;
  json: boolean;
  write: (s: string) => void;
}

/**
 * Extract the startapp session data from either:
 * - Raw base64 session data string
 * - A full redirect URL containing ?startapp=<data>
 */
function extractSessionData(options: AuthCompleteOptions): string | null {
  if (options.sessionData) {
    return options.sessionData;
  }
  if (options.redirectUrl) {
    try {
      const url = new URL(options.redirectUrl);
      return url.searchParams.get("startapp");
    } catch {
      // Maybe it's just the query string portion
      const match = options.redirectUrl.match(/[?&]startapp=([^&]+)/);
      return match ? match[1] : null;
    }
  }
  return null;
}

export async function runAuthComplete(options: AuthCompleteOptions): Promise<number> {
  if (!options.world) {
    const msg = "Usage: axis auth-complete <world> --session-data=<base64> OR --redirect-url=<url>";
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }

  const sessionData = extractSessionData(options);
  if (!sessionData) {
    const msg = "Provide --session-data=<base64> or --redirect-url=<full callback URL>";
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }

  const config = loadConfig();
  const worldDir = path.join(config.sessionBasePath, options.world);

  // Verify artifacts exist
  try {
    readArtifacts(worldDir);
  } catch {
    const msg = `No artifacts found for world "${options.world}". Run "axis auth ${options.world}" first.`;
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }

  try {
    const { address } = storeSessionFromCallback(worldDir, sessionData);

    updateAuthStatus(worldDir, { status: "active", address });

    const result = { world: options.world, status: "active", address };
    if (options.json) {
      options.write(JSON.stringify(result, null, 2));
    } else {
      options.write(`  Session activated for ${options.world} (${address})\n`);
    }
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }
}
