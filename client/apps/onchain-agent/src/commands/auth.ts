import { createServer, type Server } from "node:http";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { loadConfig } from "../config";
import { discoverAllWorlds, findWorldByName, buildWorldProfile, buildResolvedManifest } from "../world/discovery";
import { ControllerSession, buildSessionPoliciesFromRoutes } from "../session/controller-session";
import { generateActions } from "../abi/action-gen";
import { ETERNUM_OVERLAYS, createHiddenOverlays } from "../abi/domain-overlay";
import { storeSessionFromCallback } from "../session";
import { writeArtifacts, updateAuthStatus, readAuthStatus, readArtifacts } from "../session/artifacts";
import { deriveChainIdFromRpcUrl } from "../world/normalize";
import type { DiscoveredWorld } from "../world/discovery";

interface AuthOptions {
  world?: string;
  status: boolean;
  all: boolean;
  approve: boolean;
  method?: string;
  username?: string;
  password?: string;
  callbackUrl?: string;
  timeout?: number;
  redirectUrl?: string;
  sessionData?: string;
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

// ---------------------------------------------------------------------------
// Mode 1: --status (absorbed from auth-status.ts)
// ---------------------------------------------------------------------------

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

    const { routes: probeRoutes } = generateActions(artifacts.manifest, {
      overlays: { ...ETERNUM_OVERLAYS, ...createHiddenOverlays(artifacts.manifest) },
      gameName: config.gameName,
    });
    const probePolicies = buildSessionPoliciesFromRoutes(probeRoutes, {
      worldProfile: artifacts.profile,
    });

    const session = new ControllerSession({
      rpcUrl: artifacts.profile.rpcUrl ?? config.rpcUrl,
      chainId,
      gameName: config.gameName,
      basePath: sessionBasePath,
      manifest: artifacts.manifest,
      worldProfile: artifacts.profile,
      policies: probePolicies,
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

async function handleStatus(options: AuthOptions): Promise<number> {
  const config = loadConfig();

  let worldNames: string[];
  if (options.all) {
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

// ---------------------------------------------------------------------------
// Mode 2: --redirect-url or --session-data (absorbed from auth-complete.ts)
// ---------------------------------------------------------------------------

/**
 * Extract the startapp session data from either:
 * - Raw base64 session data string
 * - A full redirect URL containing ?startapp=<data>
 */
function extractSessionData(options: AuthOptions): string | null {
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

async function handleComplete(options: AuthOptions): Promise<number> {
  if (!options.world) {
    const msg = "Usage: axis auth <world> --session-data=<base64> OR --redirect-url=<url>";
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

// ---------------------------------------------------------------------------
// Mode 3: default — generate auth URL (existing flow + QR code)
// ---------------------------------------------------------------------------

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

async function authSingleWorld(world: DiscoveredWorld, options: AuthOptions): Promise<AuthResult> {
  const config = loadConfig();
  const worldDir = path.join(config.sessionBasePath, world.name);

  try {
    // 1. Build world profile and resolve manifest
    const profile = await buildWorldProfile(world.chain, world.name);
    const manifest = await buildResolvedManifest(world.chain, profile);
    // Build minimal policies from action routes (only entrypoints the agent uses)
    const { routes } = generateActions(manifest, {
      overlays: { ...ETERNUM_OVERLAYS, ...createHiddenOverlays(manifest) },
      gameName: config.gameName,
    });
    const policies = buildSessionPoliciesFromRoutes(routes, {
      worldProfile: profile,
    });

    // 2. Set up session
    const chainId = deriveChainIdFromRpcUrl(profile.rpcUrl ?? "") ?? config.chainId;
    const sessionBasePath = path.join(config.sessionBasePath, world.name);

    // Determine if we can wait for browser callback
    const canWait = options.callbackUrl || options.approve || process.stdin.isTTY;

    const session = new ControllerSession({
      rpcUrl: profile.rpcUrl ?? config.rpcUrl,
      chainId,
      gameName: config.gameName,
      basePath: sessionBasePath,
      manifest,
      worldProfile: profile,
      policies,
      callbackUrl: options.callbackUrl,
      // Suppress auto-browser-open when we can't wait for callback
      onAuthUrl: canWait ? undefined : () => {},
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
      const { close } = createCallbackServer(options.callbackUrl, (sessionData: string) =>
        session.feedCallbackData(sessionData),
      );
      serverClose = close;
    }

    // 6. Trigger connect — await the URL being ready (resolves after URL
    //    construction but before the callback wait, so we can output it).
    const connectPromise = session.connect();
    const authUrl = await session.waitForAuthUrl();

    if (authUrl) {
      updateAuthStatus(worldDir, { url: authUrl });

      // Non-blocking mode: no callback server, no auto-approve, and no TTY.
      // Print instructions and exit — user completes with `axis auth --redirect-url`.
      if (!canWait) {
        if (options.json) {
          options.write(
            JSON.stringify({
              world: world.name,
              chain: world.chain,
              status: "awaiting_approval",
              artifactDir: worldDir,
              authFile: path.join(worldDir, "auth.json"),
              completeWith: `axis auth ${world.name} --redirect-url="<redirect URL from browser>"`,
            }),
          );
        } else {
          options.write(`  Auth URL saved to: ${path.join(worldDir, "auth.json")}\n`);
          options.write(`  Open the URL in a browser to approve the session.\n`);
          options.write(`\n  Complete with:\n`);
          options.write(`  axis auth ${world.name} --redirect-url="<redirect URL from browser>"\n`);
        }
        return {
          world: world.name,
          chain: world.chain,
          status: "awaiting_approval",
          url: authUrl,
          artifactDir: worldDir,
        };
      }

      if (options.json) {
        options.write(
          JSON.stringify({
            world: world.name,
            chain: world.chain,
            status: "awaiting_approval",
            url: authUrl,
            callbackUrl: options.callbackUrl ?? null,
            artifactDir: worldDir,
          }),
        );
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

async function handleGenerateAuth(options: AuthOptions): Promise<number> {
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

  const allOk = results.every((r) => r.status === "active" || r.status === "awaiting_approval");
  return allOk ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Unified entry point — routes to the appropriate mode
// ---------------------------------------------------------------------------

export async function runAuth(options: AuthOptions): Promise<number> {
  // Mode 1: --status
  if (options.status) {
    return handleStatus(options);
  }

  // Mode 2: --redirect-url or --session-data (complete auth)
  if (options.redirectUrl || options.sessionData) {
    return handleComplete(options);
  }

  // Mode 3: default — generate auth URL
  return handleGenerateAuth(options);
}
