import { EternumClient } from "@bibliothecadao/client";
import {
  createHeartbeatLoop,
  createGameAgent,
  type HeartbeatJob,
  type RuntimeConfigApplyResult,
  type RuntimeConfigChange,
  type RuntimeConfigManager,
  type RuntimeConfigUpdateResult,
} from "@bibliothecadao/game-agent";
import { getModel, type KnownProvider } from "@mariozechner/pi-ai";
import { readFile } from "node:fs/promises";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import type { AccountInterface } from "starknet";
import { createShutdownGate } from "./shutdown-gate";
import { type AgentConfig, loadConfig } from "./config";
import { EternumGameAdapter } from "./adapter/eternum-adapter";
import { MutableGameAdapter } from "./adapter/mutable-adapter";
import { ControllerSession } from "./session";
import { createApp } from "./tui/app";
import { type DiscoveredWorld, discoverAllWorlds, buildWorldProfile, buildResolvedManifest } from "./world/discovery";
import { normalizeRpcUrl, deriveChainIdFromRpcUrl } from "./world/normalize";
import type { WorldProfile } from "./world/types";
import { createWorldPicker } from "./tui/world-picker";
import { createInspectTools } from "./tools/inspect-tools";
import { getActionDefinitions } from "./adapter/action-registry";
import { formatEternumTickPrompt, type EternumWorldState } from "./adapter/world-state";

/**
 * Load all reference handbooks (autoload: false task files) from the data
 * directory.  These are injected into the first tick prompt so the agent
 * starts with full game knowledge, and can be re-read via heartbeat jobs.
 */
function loadReferenceHandbooks(dataDir: string): string {
  const taskDir = path.join(dataDir, "tasks");
  if (!existsSync(taskDir)) return "";

  const sections: string[] = [];
  let files: string[];
  try {
    files = readdirSync(taskDir).filter((f: string) => f.endsWith(".md")).sort();
  } catch {
    return "";
  }

  for (const file of files) {
    const raw = readFileSync(path.join(taskDir, file), "utf-8");
    // Only include files that are NOT autoloaded (the reference handbooks)
    const autoloadMatch = raw.match(/^---\n[\s\S]*?autoload:\s*(true|false)[\s\S]*?\n---/);
    if (autoloadMatch && autoloadMatch[1] === "true") continue;
    // Also skip files without frontmatter (shouldn't happen, but be safe)
    if (!raw.startsWith("---\n")) continue;

    const domain = file.replace(/\.md$/, "");
    const content = raw.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
    if (content) {
      sections.push(`<reference domain="${domain}">\n${content}\n</reference>`);
    }
  }

  if (sections.length === 0) return "";
  return `## Reference Handbooks (study these before acting)\n\n${sections.join("\n\n")}`;
}

export async function loadManifest(manifestPath: string): Promise<{ contracts: unknown[] }> {
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.contracts)) {
    throw new Error(`Invalid manifest at ${manifestPath}: missing contracts[]`);
  }
  return parsed;
}

interface RuntimeServices {
  client: EternumClient;
  account: AccountInterface;
  session: ControllerSession;
  adapter: EternumGameAdapter;
}

const CONFIG_PATH_ALIASES: Record<string, keyof AgentConfig> = {
  rpcurl: "rpcUrl",
  "world.rpcurl": "rpcUrl",
  toriiurl: "toriiUrl",
  "world.toriiurl": "toriiUrl",
  worldaddress: "worldAddress",
  "world.worldaddress": "worldAddress",
  manifestpath: "manifestPath",
  "world.manifestpath": "manifestPath",
  gamename: "gameName",
  "game.name": "gameName",
  chainid: "chainId",
  "session.chainid": "chainId",
  sessionbasepath: "sessionBasePath",
  "session.basepath": "sessionBasePath",
  tickintervalms: "tickIntervalMs",
  "loop.tickintervalms": "tickIntervalMs",
  loopenabled: "loopEnabled",
  "loop.enabled": "loopEnabled",
  modelprovider: "modelProvider",
  "model.provider": "modelProvider",
  modelid: "modelId",
  "model.id": "modelId",
  datadir: "dataDir",
  "agent.datadir": "dataDir",
};

const BACKEND_KEYS = new Set<keyof AgentConfig>([
  "rpcUrl",
  "toriiUrl",
  "worldAddress",
  "manifestPath",
  "gameName",
  "chainId",
  "sessionBasePath",
]);

function resolveConfigPath(pathValue: string): keyof AgentConfig | null {
  const normalized = pathValue.trim().toLowerCase();
  return CONFIG_PATH_ALIASES[normalized] ?? null;
}

function parseBoolean(value: unknown, key: string): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
    if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  }
  throw new Error(`Invalid boolean for ${key}`);
}

function parsePositiveInt(value: unknown, key: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid positive number for ${key}`);
  }
  return Math.floor(numeric);
}

function parseString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid string for ${key}`);
  }
  return value.trim();
}

function parseConfigValue(key: keyof AgentConfig, value: unknown): AgentConfig[keyof AgentConfig] {
  switch (key) {
    case "tickIntervalMs":
      return parsePositiveInt(value, key);
    case "loopEnabled":
      return parseBoolean(value, key);
    case "chain":
    case "rpcUrl":
    case "toriiUrl":
    case "worldAddress":
    case "manifestPath":
    case "gameName":
    case "chainId":
    case "sessionBasePath":
    case "modelProvider":
    case "modelId":
    case "dataDir":
      return parseString(value, key);
    default:
      return value as never;
  }
}

function updateResultForKey(
  key: keyof AgentConfig,
  pending: Array<{ key: keyof AgentConfig; result: RuntimeConfigUpdateResult }>,
  applied: boolean,
  message: string,
) {
  for (const item of pending) {
    if (item.key === key) {
      item.result.applied = applied;
      item.result.message = message;
    }
  }
}

async function createRuntimeServices(
  config: AgentConfig,
  resolvedManifest?: { contracts: unknown[] },
  worldProfile?: WorldProfile,
): Promise<RuntimeServices> {
  if (!resolvedManifest && !config.manifestPath) {
    throw new Error("No manifest available: use world discovery or set MANIFEST_PATH");
  }
  const manifest = resolvedManifest ?? (await loadManifest(path.resolve(config.manifestPath!)));

  const chainId = deriveChainIdFromRpcUrl(config.rpcUrl) ?? config.chainId;

  // Each world gets its own session directory so switching worlds doesn't
  // invalidate the on-chain session registration (policies Merkle root).
  const sessionBasePath = worldProfile
    ? path.join(config.sessionBasePath, worldProfile.name)
    : config.sessionBasePath;

  const session = new ControllerSession({
    rpcUrl: config.rpcUrl,
    chainId,
    gameName: config.gameName,
    basePath: sessionBasePath,
    manifest,
    worldProfile,
  });

  const account = await session.connect();

  const client = await EternumClient.create({
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    worldAddress: config.worldAddress,
    manifest: manifest as any,
  });
  client.connect(account as any);
  const tokenConfig = worldProfile ? {
    feeToken: worldProfile.feeTokenAddress,
    entryToken: worldProfile.entryTokenAddress,
    worldAddress: config.worldAddress,
  } : undefined;
  const adapter = new EternumGameAdapter(client, account as any, account.address, manifest as any, config.gameName, tokenConfig);
  return { client, account, session, adapter };
}

export async function main() {
  // Ensure clean exit on Ctrl+C at any point (e.g. during auth URL wait)
  process.on("SIGINT", () => {
    process.stdout.write("\x1b[?25h"); // restore cursor
    console.log("\nExiting.");
    process.exit(0);
  });

  let runtimeConfig: AgentConfig = loadConfig();
  let resolvedManifest: { contracts: unknown[] } | undefined;
  let currentWorldProfile: WorldProfile | undefined;

  // World Discovery Flow — resolve config from factory unless all overrides are set
  const hasManualOverrides = runtimeConfig.rpcUrl && runtimeConfig.toriiUrl && runtimeConfig.worldAddress;
  if (!hasManualOverrides) {
    // Discovery happens silently — the TUI picker shows the results
    const worlds = await discoverAllWorlds();

    if (worlds.length === 0) {
      console.error("No worlds found on any chain.");
      process.exit(1);
    }

    // Auto-select if SLOT_NAME matches a discovered world (skip TUI picker)
    const slotName = process.env.SLOT_NAME;
    let selected: DiscoveredWorld | null = null;
    if (slotName) {
      selected = worlds.find((w) => w.name === slotName) ?? null;
      if (selected) {
        console.log(`  Auto-selected world: [${selected.chain}] ${selected.name}`);
      } else {
        console.log(
          `  SLOT_NAME="${slotName}" did not match any world. Available: ${worlds.map((w) => w.name).join(", ")}`,
        );
      }
    }
    if (!selected) {
      if (!process.stdin.isTTY) {
        console.error("No world selected and no TTY available for picker. Set SLOT_NAME env var.");
        process.exit(1);
      }
      selected = await createWorldPicker(worlds);
    }
    if (!selected) {
      console.log("No world selected. Exiting.");
      process.exit(0);
    }

    // Update chain from the selected world
    runtimeConfig.chain = selected.chain;

    console.log("  Building world profile...");
    const profile = await buildWorldProfile(selected.chain, selected.name);
    currentWorldProfile = profile;
    console.log("  Profile built. Resolving manifest...");
    resolvedManifest = await buildResolvedManifest(selected.chain, profile);
    console.log("  Manifest resolved.");

    runtimeConfig.rpcUrl = normalizeRpcUrl(profile.rpcUrl ?? runtimeConfig.rpcUrl);
    runtimeConfig.toriiUrl = `${profile.toriiBaseUrl}/sql`;
    runtimeConfig.worldAddress = profile.worldAddress;
    runtimeConfig.chainId = deriveChainIdFromRpcUrl(runtimeConfig.rpcUrl) ?? runtimeConfig.chainId;
  }

  console.log("  Connecting controller session...");
  // Listen for Escape/Ctrl+C during init (connect, sync, etc.)
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data: Buffer) => {
      const str = data.toString();
      if (str === "\x1b" || str === "\x03") {
        process.stdout.write("\x1b[?25h");
        console.log("\nExiting.");
        process.exit(0);
      }
    });
  }

  let services = await createRuntimeServices(runtimeConfig, resolvedManifest, currentWorldProfile);
  const adapter = new MutableGameAdapter(services.adapter);

  // Lazy reference for TUI messages — set once TUI is created, avoids console.log to raw stdout
  let systemMessage: ((msg: string) => void) | null = null;
  let runtimeAgent: ReturnType<typeof createGameAgent> | null = null;
  let applyQueue: Promise<RuntimeConfigApplyResult> = Promise.resolve({
    ok: true,
    results: [],
    currentConfig: { ...runtimeConfig },
  });

  const applyChangesInternal = async (
    changes: RuntimeConfigChange[],
    reason?: string,
  ): Promise<RuntimeConfigApplyResult> => {
    const results: RuntimeConfigUpdateResult[] = [];
    const pending: Array<{ key: keyof AgentConfig; result: RuntimeConfigUpdateResult }> = [];
    const candidate: AgentConfig = { ...runtimeConfig };
    const changedKeys = new Set<keyof AgentConfig>();

    for (const change of changes) {
      const key = resolveConfigPath(change.path);
      if (!key) {
        results.push({
          path: change.path,
          applied: false,
          message: `Unknown config path '${change.path}'`,
        });
        continue;
      }

      try {
        const parsed = parseConfigValue(key, change.value) as AgentConfig[typeof key];
        if (candidate[key] === parsed) {
          results.push({
            path: change.path,
            applied: true,
            message: `${key} already set`,
          });
          continue;
        }
        (candidate as unknown as Record<string, unknown>)[key] = parsed;
        changedKeys.add(key);
        const result: RuntimeConfigUpdateResult = {
          path: change.path,
          applied: false,
          message: "queued",
        };
        results.push(result);
        pending.push({ key, result });
      } catch (error) {
        results.push({
          path: change.path,
          applied: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const backendChanged = Array.from(changedKeys).some((key) => BACKEND_KEYS.has(key));
    if (backendChanged) {
      try {
        const nextServices = await createRuntimeServices(candidate, resolvedManifest, currentWorldProfile);
        adapter.setAdapter(nextServices.adapter);
        services.client.disconnect();
        services = nextServices;
        for (const key of BACKEND_KEYS) {
          if (changedKeys.has(key)) {
            updateResultForKey(key, pending, true, `Applied ${key} live via hot-swap`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const key of BACKEND_KEYS) {
          if (changedKeys.has(key)) {
            (candidate as unknown as Record<string, unknown>)[key] = runtimeConfig[key];
            updateResultForKey(key, pending, false, `Failed to apply ${key}: ${message}`);
          }
        }
      }
    }

    if (runtimeAgent && changedKeys.has("tickIntervalMs")) {
      try {
        runtimeAgent.ticker.setIntervalMs(candidate.tickIntervalMs);
        updateResultForKey("tickIntervalMs", pending, true, "Updated live tick interval");
      } catch (error) {
        candidate.tickIntervalMs = runtimeConfig.tickIntervalMs;
        const message = error instanceof Error ? error.message : String(error);
        updateResultForKey("tickIntervalMs", pending, false, message);
      }
    }

    if (runtimeAgent && changedKeys.has("loopEnabled")) {
      if (candidate.loopEnabled) {
        runtimeAgent.ticker.start();
      } else {
        runtimeAgent.ticker.stop();
      }
      updateResultForKey("loopEnabled", pending, true, "Updated live loop state");
    }

    if (runtimeAgent && (changedKeys.has("modelProvider") || changedKeys.has("modelId"))) {
      try {
        const nextModel = (getModel as Function)(candidate.modelProvider, candidate.modelId);
        runtimeAgent.agent.setModel(nextModel);
        if (typeof (runtimeAgent.agent as any).setThinkingLevel === "function") {
          (runtimeAgent.agent as any).setThinkingLevel(nextModel.reasoning ? "medium" : "off");
        }
        updateResultForKey("modelProvider", pending, true, "Updated live model provider");
        updateResultForKey("modelId", pending, true, "Updated live model id");
      } catch (error) {
        candidate.modelProvider = runtimeConfig.modelProvider;
        candidate.modelId = runtimeConfig.modelId;
        const message = error instanceof Error ? error.message : String(error);
        updateResultForKey("modelProvider", pending, false, message);
        updateResultForKey("modelId", pending, false, message);
      }
    }

    if (runtimeAgent && changedKeys.has("dataDir")) {
      try {
        runtimeAgent.setDataDir(candidate.dataDir);
        updateResultForKey("dataDir", pending, true, "Updated live data directory");
      } catch (error) {
        candidate.dataDir = runtimeConfig.dataDir;
        const message = error instanceof Error ? error.message : String(error);
        updateResultForKey("dataDir", pending, false, message);
      }
    }

    runtimeConfig = candidate;

    if (reason) {
      systemMessage?.(`Applied runtime config changes (${reason})`);
    }

    return {
      ok: results.every((result) => result.applied),
      results,
      currentConfig: { ...runtimeConfig },
    };
  };

  const runtimeConfigManager: RuntimeConfigManager = {
    getConfig: () => ({ ...runtimeConfig }),
    applyChanges(changes, reason) {
      const run = () => applyChangesInternal(changes, reason);
      applyQueue = applyQueue.then(run, run);
      return applyQueue;
    },
  };

  // 4. Create the game agent
  //    First tick gets all reference handbooks prepended so the agent starts
  //    with full game knowledge before taking any actions.
  const model = (getModel as Function)(runtimeConfig.modelProvider, runtimeConfig.modelId);
  let isFirstTick = true;
  const formatTickPromptWithHandbooks = (state: EternumWorldState): string => {
    const base = formatEternumTickPrompt(state);
    if (isFirstTick) {
      isFirstTick = false;
      const handbooks = loadReferenceHandbooks(runtimeConfig.dataDir);
      if (handbooks) {
        return `${handbooks}\n\n---\n\n${base}\n\nIMPORTANT: This is your first tick. Study the reference handbooks above carefully before taking any actions. Write key insights to tasks/learnings.md so you retain them.`;
      }
    }
    return base;
  };
  const game = createGameAgent({
    adapter,
    dataDir: runtimeConfig.dataDir,
    model,
    tickIntervalMs: runtimeConfig.tickIntervalMs,
    runtimeConfigManager,
    extraTools: createInspectTools(services.client),
    actionDefs: getActionDefinitions(),
    formatTickPrompt: formatTickPromptWithHandbooks,
    onTickError: (err) => {
      systemMessage?.(`Tick error: ${err.message}`);
    },
  });
  runtimeAgent = game;
  const { agent, ticker, dispose: disposeAgent } = game;

  // Hand stdin back to the TUI
  process.stdin.removeAllListeners("data");
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();

  // 5. Create the TUI
  const { dispose: disposeTui, addSystemMessage } = createApp({ agent, ticker });
  systemMessage = addSystemMessage;

  const heartbeat = createHeartbeatLoop({
    getHeartbeatPath: () => path.join(runtimeConfig.dataDir, "HEARTBEAT.md"),
    onRun: async (job: HeartbeatJob) => {
      if (!runtimeAgent) {
        return;
      }
      const modeGuidance =
        job.mode === "observe"
          ? "Observe-only heartbeat: do not execute on-chain actions. You may read and update markdown/task files."
          : "Action-enabled heartbeat: you may execute actions if justified.";
      const heartbeatPrompt = [
        `## Heartbeat Job: ${job.id}`,
        `Schedule: ${job.schedule}`,
        `Mode: ${job.mode}`,
        modeGuidance,
        "Follow the job instructions below:",
        job.prompt,
      ].join("\n\n");
      await runtimeAgent.enqueuePrompt(heartbeatPrompt);
    },
    onError: (error) => {
      addSystemMessage(`Heartbeat error: ${error.message}`);
    },
  });

  // 6. Start the tick loop
  if (runtimeConfig.loopEnabled) {
    ticker.start();
  } else {
    addSystemMessage("Loop: disabled (set LOOP_ENABLED=true or use set_agent_config)");
  }
  heartbeat.start();

  addSystemMessage("Agent running. Press Ctrl+C to exit.");

  // 7. Graceful shutdown
  const gate = createShutdownGate();

  const shutdown = async () => {
    heartbeat.stop();
    ticker.stop();
    await disposeAgent();
    disposeTui();
    services.client.disconnect();
    gate.shutdown();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return gate.promise;
}

// Entry point is cli.ts — do NOT add an isDirectExecution guard here.
// In the Bun binary, all modules share the same import.meta.url, so a guard
// here would fire in parallel with cli.ts's guard, calling main() twice and
// opening two browser auth tabs with different keypairs.
