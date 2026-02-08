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
import { getModel } from "@mariozechner/pi-ai";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AccountInterface } from "starknet";
import { type AgentConfig, loadConfig } from "./config";
import { resolveManifest } from "./manifest-resolver";
import { EternumGameAdapter } from "./adapter/eternum-adapter";
import { MutableGameAdapter } from "./adapter/mutable-adapter";
import { ControllerSession } from "./session";
import { createApp } from "./tui/app";

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
  "rpcurl": "rpcUrl",
  "world.rpcurl": "rpcUrl",
  "toriiurl": "toriiUrl",
  "world.toriiurl": "toriiUrl",
  "worldaddress": "worldAddress",
  "world.worldaddress": "worldAddress",
  "manifestpath": "manifestPath",
  "world.manifestpath": "manifestPath",
  "gamename": "gameName",
  "game.name": "gameName",
  "slotname": "slotName",
  "slot.name": "slotName",
  "chain": "chain",
  "chainid": "chainId",
  "session.chainid": "chainId",
  "sessionbasepath": "sessionBasePath",
  "session.basepath": "sessionBasePath",
  "tickintervalms": "tickIntervalMs",
  "loop.tickintervalms": "tickIntervalMs",
  "loopenabled": "loopEnabled",
  "loop.enabled": "loopEnabled",
  "modelprovider": "modelProvider",
  "model.provider": "modelProvider",
  "modelid": "modelId",
  "model.id": "modelId",
  "datadir": "dataDir",
  "agent.datadir": "dataDir",
};

const BACKEND_KEYS = new Set<keyof AgentConfig>([
  "chain",
  "rpcUrl",
  "toriiUrl",
  "worldAddress",
  "manifestPath",
  "gameName",
  "slotName",
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
    case "slotName":
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

/**
 * Resolve the manifest, world address, torii URL, and RPC URL.
 * If manual overrides are set in config, use those; otherwise auto-resolve from chain + gameName.
 */
async function resolveWorldConfig(config: AgentConfig): Promise<{
  manifest: { contracts: unknown[]; [key: string]: unknown };
  worldAddress: string;
  toriiUrl: string;
  rpcUrl: string;
}> {
  const hasManualConfig = config.manifestPath && config.worldAddress && config.toriiUrl && config.rpcUrl;

  if (hasManualConfig) {
    const manifest = await loadManifest(path.resolve(config.manifestPath));
    return {
      manifest,
      worldAddress: config.worldAddress,
      toriiUrl: config.toriiUrl,
      rpcUrl: config.rpcUrl,
    };
  }

  // Auto-resolve from chain + slotName
  const slotName = config.slotName || config.gameName;
  const resolved = await resolveManifest(config.chain, slotName);

  return {
    manifest: resolved.manifest,
    worldAddress: config.worldAddress || resolved.worldAddress,
    toriiUrl: config.toriiUrl || resolved.toriiUrl,
    rpcUrl: config.rpcUrl || resolved.rpcUrl,
  };
}

async function createRuntimeServices(config: AgentConfig): Promise<RuntimeServices> {
  const { manifest, worldAddress, toriiUrl, rpcUrl } = await resolveWorldConfig(config);

  const session = new ControllerSession({
    rpcUrl,
    chainId: config.chainId,
    gameName: config.gameName,
    basePath: config.sessionBasePath,
    manifest,
  });

  console.log("Connecting to Cartridge Controller...");
  const account = await session.connect();
  console.log(`Session ready! Account: ${account.address}`);

  const client = await EternumClient.create({
    rpcUrl,
    toriiUrl,
    worldAddress,
    manifest,
  });
  client.connect(account as any);
  const adapter = new EternumGameAdapter(client, account as any, account.address);
  return { client, account, session, adapter };
}

export async function main() {
  let runtimeConfig: AgentConfig = loadConfig();

  console.log("Initializing Eternum Agent...");
  console.log(`  Chain: ${runtimeConfig.chain}`);
  console.log(`  Game: ${runtimeConfig.gameName}`);
  if (runtimeConfig.slotName) console.log(`  Slot: ${runtimeConfig.slotName}`);
  console.log(`  Model: ${runtimeConfig.modelProvider}/${runtimeConfig.modelId}`);

  let services = await createRuntimeServices(runtimeConfig);
  const adapter = new MutableGameAdapter(services.adapter);

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
        const nextServices = await createRuntimeServices(candidate);
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
        const nextModel = getModel(candidate.modelProvider, candidate.modelId);
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
      console.log(`Applied runtime config changes (${reason})`);
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
  const model = getModel(runtimeConfig.modelProvider, runtimeConfig.modelId);
  const game = createGameAgent({
    adapter,
    dataDir: runtimeConfig.dataDir,
    model,
    tickIntervalMs: runtimeConfig.tickIntervalMs,
    runtimeConfigManager,
  });
  runtimeAgent = game;
  const { agent, ticker, dispose: disposeAgent } = game;

  // 5. Create the TUI
  const { dispose: disposeTui } = createApp({ agent, ticker });

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
      console.error("Heartbeat error:", error.message);
    },
  });

  // 6. Start the tick loop
  if (runtimeConfig.loopEnabled) {
    ticker.start();
  } else {
    console.log("  Loop: disabled (set LOOP_ENABLED=true or use set_agent_config)");
  }
  heartbeat.start();

  console.log("Agent running. Press Ctrl+C to exit.\n");

  // 7. Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...");
    heartbeat.stop();
    ticker.stop();
    await disposeAgent();
    disposeTui();
    services.client.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function isDirectExecution(metaUrl: string): boolean {
  if (!process.argv[1]) {
    return false;
  }

  try {
    const currentModulePath = fileURLToPath(metaUrl);
    return path.resolve(process.argv[1]) === path.resolve(currentModulePath);
  } catch {
    return false;
  }
}

if (isDirectExecution(import.meta.url)) {
  main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
