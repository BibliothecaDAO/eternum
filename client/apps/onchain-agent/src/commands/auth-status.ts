import path from "node:path";
import { existsSync } from "node:fs";
import { loadConfig } from "../config";
import { readAuthStatus, readArtifacts } from "../session/artifacts";
import { ControllerSession } from "../session/controller-session";
import { deriveChainIdFromRpcUrl } from "../world/normalize";

interface AuthStatusOptions {
  world?: string;
  all: boolean;
  json: boolean;
  write: (s: string) => void;
}

interface StatusResult {
  world: string;
  status: "active" | "expired" | "pending" | "none";
  address?: string;
  chain?: string;
  expiresAt?: string;
}

async function checkSingleWorld(worldName: string): Promise<StatusResult> {
  const config = loadConfig();
  const worldDir = path.join(config.sessionBasePath, worldName);

  if (!existsSync(worldDir)) {
    return { world: worldName, status: "none" };
  }

  const authMeta = readAuthStatus(worldDir);
  if (authMeta.status === "none") {
    return { world: worldName, status: "none" };
  }

  // Try to probe the actual session
  try {
    const artifacts = readArtifacts(worldDir);
    const chainId = deriveChainIdFromRpcUrl(artifacts.profile.rpcUrl ?? "") ?? config.chainId;
    const sessionBasePath = path.join(config.sessionBasePath, worldName);

    const session = new ControllerSession({
      rpcUrl: artifacts.profile.rpcUrl ?? config.rpcUrl,
      chainId,
      gameName: config.gameName,
      basePath: sessionBasePath,
      manifest: artifacts.manifest,
      worldProfile: artifacts.profile,
    });

    const account = await session.probe();
    if (account) {
      return {
        world: worldName,
        status: "active",
        address: account.address,
        chain: authMeta.chain,
        expiresAt: authMeta.expiresAt,
      };
    }
  } catch {
    // Probe failed — session is expired or invalid
  }

  // Session not active — check if it was previously active (now expired) or still pending
  const status = authMeta.status === "active" ? "expired" : authMeta.status;
  return {
    world: worldName,
    status: status as StatusResult["status"],
    chain: authMeta.chain,
    address: authMeta.address,
  };
}

export async function runAuthStatus(options: AuthStatusOptions): Promise<number> {
  const config = loadConfig();

  let worldNames: string[];
  if (options.all) {
    // List all world directories in session base path
    const { readdirSync } = await import("node:fs");
    try {
      worldNames = readdirSync(config.sessionBasePath).filter((entry) => {
        return existsSync(path.join(config.sessionBasePath, entry, "auth.json"));
      });
    } catch {
      worldNames = [];
    }
  } else if (options.world) {
    worldNames = [options.world];
  } else {
    const msg = "Specify a world name or use --all";
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }

  if (worldNames.length === 0) {
    if (options.json) {
      options.write(JSON.stringify([]));
    } else {
      options.write("No authenticated worlds found.\n");
    }
    return 0;
  }

  const results: StatusResult[] = [];
  for (const name of worldNames) {
    results.push(await checkSingleWorld(name));
  }

  if (options.json) {
    options.write(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    for (const r of results) {
      const addr = r.address ? ` (${r.address})` : "";
      options.write(`  ${r.world}: ${r.status}${addr}\n`);
    }
  }

  return 0;
}
