import { createServer, type Server } from "node:http";
import path from "node:path";
import { loadConfig } from "../config";
import { discoverAllWorlds, findWorldByName, buildWorldProfile, buildResolvedManifest } from "../world/discovery";
import { ControllerSession, buildSessionPoliciesFromManifest } from "../session/controller-session";
import { writeArtifacts, updateAuthStatus } from "../session/artifacts";
import { deriveChainIdFromRpcUrl } from "../world/normalize";
import type { DiscoveredWorld } from "../world/discovery";

interface AuthOptions {
  world?: string;
  all: boolean;
  approve: boolean;
  method?: string;
  username?: string;
  password?: string;
  callbackUrl?: string;
  timeout?: number;
  json: boolean;
  write: (s: string) => void;
}

interface AuthResult {
  world: string;
  chain: string;
  status: string;
  url?: string;
  address?: string;
  artifactDir: string;
  error?: string;
}

/**
 * Lightweight HTTP server that only handles the /auth/callback endpoint.
 * Supports both GET (browser redirect_uri) and POST (server-side callback_uri).
 */
function createCallbackServer(
  callbackUrl: string,
  onCallback: (sessionData: string) => void,
): { server: Server; close: () => Promise<void> } {
  const parsed = new URL(callbackUrl);
  const port = parseInt(parsed.port || "3000", 10);
  const host = parsed.hostname || "127.0.0.1";

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/auth/callback") {
      if (req.method === "GET") {
        // Browser redirect: session data in ?startapp= query param
        const sessionData = url.searchParams.get("startapp");
        if (sessionData) {
          onCallback(sessionData);
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(
            "<html><body><script>window.close();</script>Session approved. You can close this window.</body></html>",
          );
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          res.end("<html><body>Missing session data.</body></html>");
        }
      } else if (req.method === "POST") {
        // Server-side callback_uri: Cartridge POSTs session data in body
        const chunks: Buffer[] = [];
        req.on("data", (chunk: Buffer) => chunks.push(chunk));
        req.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          onCallback(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
        });
      } else {
        res.writeHead(405);
        res.end();
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(port, host);

  return {
    server,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function authSingleWorld(
  world: DiscoveredWorld,
  options: AuthOptions,
): Promise<AuthResult> {
  const config = loadConfig();
  const worldDir = path.join(config.sessionBasePath, world.name);

  try {
    // 1. Build world profile and resolve manifest
    const profile = await buildWorldProfile(world.chain, world.name);
    const manifest = await buildResolvedManifest(world.chain, profile);
    const policies = buildSessionPoliciesFromManifest(manifest, {
      gameName: config.gameName,
      worldProfile: profile,
    });

    // 2. Set up session
    const chainId = deriveChainIdFromRpcUrl(profile.rpcUrl ?? "") ?? config.chainId;
    const sessionBasePath = path.join(config.sessionBasePath, world.name);

    const session = new ControllerSession({
      rpcUrl: profile.rpcUrl ?? config.rpcUrl,
      chainId,
      gameName: config.gameName,
      basePath: sessionBasePath,
      manifest,
      worldProfile: profile,
      callbackUrl: options.callbackUrl,
    });

    // 3. Write artifacts
    writeArtifacts(worldDir, {
      profile,
      manifest,
      policy: policies as Record<string, unknown>,
      auth: {
        url: "",
        status: "pending",
        worldName: world.name,
        chain: world.chain,
        createdAt: new Date().toISOString(),
      },
    });

    // 4. Check for existing session first
    const existing = await session.probe();
    if (existing) {
      updateAuthStatus(worldDir, {
        status: "active",
        address: existing.address,
      });
      return {
        world: world.name,
        chain: world.chain,
        status: "active",
        address: existing.address,
        artifactDir: worldDir,
      };
    }

    // 5. If using --callback-url, start a lightweight callback server
    let serverClose: (() => Promise<void>) | null = null;
    if (options.callbackUrl) {
      const { close } = createCallbackServer(
        options.callbackUrl,
        (sessionData: string) => session.feedCallbackData(sessionData),
      );
      serverClose = close;
    }

    // 6. Trigger connect — await the URL being ready (resolves after URL
    //    construction but before the callback wait, so we can output it).
    const connectPromise = session.connect();
    const authUrl = await session.waitForAuthUrl();

    if (authUrl) {
      updateAuthStatus(worldDir, { url: authUrl });

      if (options.json) {
        options.write(JSON.stringify({
          world: world.name,
          chain: world.chain,
          status: "awaiting_approval",
          url: authUrl,
          callbackUrl: options.callbackUrl ?? null,
          artifactDir: worldDir,
        }));
        options.write("");
      } else {
        options.write(`  Approve at: ${authUrl}\n`);
        if (options.callbackUrl) {
          options.write(`  Callback listening at: ${options.callbackUrl}\n`);
        }
        options.write(`  Waiting for approval...\n`);
      }
    }

    // 7. If --approve, run auth-approve
    if (options.approve && authUrl) {
      try {
        const { runAuthApprove } = await import("../session/auth-approve");
        await runAuthApprove({
          authUrl,
          method: options.method ?? "password",
          username: options.username,
          password: options.password,
        });
      } catch (approveErr) {
        const errorMsg = approveErr instanceof Error ? approveErr.message : String(approveErr);
        if (serverClose) await serverClose();
        updateAuthStatus(worldDir, { status: "pending" });
        return {
          world: world.name,
          chain: world.chain,
          status: "pending",
          url: authUrl,
          artifactDir: worldDir,
          error: `Auto-approve failed: ${errorMsg}`,
        };
      }
    }

    // 8. Wait for session approval
    try {
      const account = await connectPromise;
      if (serverClose) await serverClose();
      updateAuthStatus(worldDir, {
        status: "active",
        address: account.address,
      });
      return {
        world: world.name,
        chain: world.chain,
        status: "active",
        address: account.address,
        url: authUrl,
        artifactDir: worldDir,
      };
    } catch {
      if (serverClose) await serverClose();
      return {
        world: world.name,
        chain: world.chain,
        status: "pending",
        url: authUrl,
        artifactDir: worldDir,
        error: "Session not approved within timeout",
      };
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      world: world.name,
      chain: world.chain,
      status: "error",
      artifactDir: worldDir,
      error: errorMsg,
    };
  }
}

export async function runAuth(options: AuthOptions): Promise<number> {
  let targets: DiscoveredWorld[];

  if (options.all) {
    targets = await discoverAllWorlds();
  } else if (options.world) {
    // Try direct resolution first — more reliable than full discovery
    // since it only needs the factory to resolve one world, not list all.
    const direct = await findWorldByName(options.world);
    if (direct) {
      targets = [direct];
    } else {
      // Fall back to full discovery for a better error message
      const worlds = await discoverAllWorlds();
      targets = worlds.filter((w) => w.name === options.world);
      if (targets.length === 0) {
        const msg = `World "${options.world}" not found. Available: ${worlds.map((w) => w.name).join(", ")}`;
        if (options.json) {
          options.write(JSON.stringify({ error: msg }));
        } else {
          options.write(`${msg}\n`);
        }
        return 1;
      }
    }
  } else {
    targets = await discoverAllWorlds();
  }

  if (targets.length === 0) {
    const msg = "No worlds discovered";
    if (options.json) {
      options.write(JSON.stringify({ error: msg }));
    } else {
      options.write(`${msg}\n`);
    }
    return 1;
  }

  const results: AuthResult[] = [];

  for (const world of targets) {
    if (!options.json) {
      options.write(`Authenticating [${world.chain}] ${world.name}...\n`);
    }
    const result = await authSingleWorld(world, options);
    results.push(result);
  }

  if (options.json) {
    options.write(JSON.stringify(results.length === 1 ? results[0] : results, null, 2));
  } else {
    for (const r of results) {
      if (r.status === "active") {
        options.write(`  [${r.chain}] ${r.world}: active (${r.address})\n`);
      } else if (r.url) {
        options.write(`  [${r.chain}] ${r.world}: pending — approve at: ${r.url}\n`);
      } else if (r.error) {
        options.write(`  [${r.chain}] ${r.world}: ${r.error}\n`);
      }
    }
  }

  const allActive = results.every((r) => r.status === "active");
  return allActive ? 0 : 1;
}
