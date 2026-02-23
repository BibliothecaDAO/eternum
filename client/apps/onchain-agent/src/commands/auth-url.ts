import path from "node:path";
import { loadConfig } from "../config";
import { readAuthStatus } from "../session/artifacts";

interface AuthUrlOptions {
  world?: string;
  write: (s: string) => void;
}

export async function runAuthUrl(options: AuthUrlOptions): Promise<number> {
  if (!options.world) {
    options.write("Usage: axis auth-url <world-name>\n");
    return 1;
  }

  const config = loadConfig();
  const worldDir = path.join(config.sessionBasePath, options.world);
  const auth = readAuthStatus(worldDir);

  if (auth.status === "none" || !auth.url) {
    options.write(`No auth URL found for world "${options.world}". Run "axis auth ${options.world}" first.\n`);
    return 1;
  }

  options.write(auth.url);
  return 0;
}
