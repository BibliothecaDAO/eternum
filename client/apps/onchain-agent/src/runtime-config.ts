import type {
  RuntimeConfigApplyResult,
  RuntimeConfigChange,
  RuntimeConfigManager,
  RuntimeConfigUpdateResult,
} from "@bibliothecadao/game-agent";
import { getModel } from "@mariozechner/pi-ai";
import type { AgentConfig } from "./config";

// ---------------------------------------------------------------------------
// Agent handle — the subset of GameAgentResult used by config management
// ---------------------------------------------------------------------------

export interface AgentHandle {
  ticker: {
    start(): void;
    stop(): void;
    setIntervalMs(intervalMs: number): void;
  };
  agent: {
    setModel(model: unknown): void;
  };
  setDataDir(dataDir: string): void;
}

// ---------------------------------------------------------------------------
// Config path aliases & backend keys
// ---------------------------------------------------------------------------

export const CONFIG_PATH_ALIASES: Record<string, keyof AgentConfig> = {
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

export const BACKEND_KEYS = new Set<keyof AgentConfig>([
  "rpcUrl",
  "toriiUrl",
  "worldAddress",
  "manifestPath",
  "gameName",
  "chainId",
  "sessionBasePath",
]);

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

export function resolveConfigPath(pathValue: string): keyof AgentConfig | null {
  const normalized = pathValue.trim().toLowerCase();
  return CONFIG_PATH_ALIASES[normalized] ?? null;
}

export function parseBoolean(value: unknown, key: string): boolean {
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

export function parsePositiveInt(value: unknown, key: string): number {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid positive number for ${key}`);
  }
  return Math.floor(numeric);
}

export function parseString(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid string for ${key}`);
  }
  return value.trim();
}

export function parseConfigValue(key: keyof AgentConfig, value: unknown): AgentConfig[keyof AgentConfig] {
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface RuntimeConfigDeps {
  getConfig: () => AgentConfig;
  setConfig: (config: AgentConfig) => void;
  getAgent: () => AgentHandle | null;
  onBackendKeysChanged?: (candidate: AgentConfig, changedKeys: Set<keyof AgentConfig>) => Promise<void>;
  onMessage?: (msg: string) => void;
}

export function createRuntimeConfigManager(deps: RuntimeConfigDeps): RuntimeConfigManager {
  let applyQueue: Promise<RuntimeConfigApplyResult> = Promise.resolve({
    ok: true,
    results: [],
    currentConfig: { ...deps.getConfig() },
  });

  const applyChangesInternal = async (
    changes: RuntimeConfigChange[],
    reason?: string,
  ): Promise<RuntimeConfigApplyResult> => {
    const runtimeConfig = deps.getConfig();
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

    // Backend keys (rpcUrl, toriiUrl, worldAddress, etc.)
    const backendChanged = Array.from(changedKeys).some((key) => BACKEND_KEYS.has(key));
    if (backendChanged) {
      if (deps.onBackendKeysChanged) {
        try {
          await deps.onBackendKeysChanged(candidate, changedKeys);
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
      } else {
        // No backend hot-swap available (e.g. headless mode)
        for (const key of BACKEND_KEYS) {
          if (changedKeys.has(key)) {
            (candidate as unknown as Record<string, unknown>)[key] = runtimeConfig[key];
            updateResultForKey(
              key,
              pending,
              false,
              `Cannot hot-swap ${key} in headless mode — restart with updated env vars`,
            );
          }
        }
      }
    }

    const agent = deps.getAgent();

    if (agent && changedKeys.has("tickIntervalMs")) {
      try {
        agent.ticker.setIntervalMs(candidate.tickIntervalMs);
        updateResultForKey("tickIntervalMs", pending, true, "Updated live tick interval");
      } catch (error) {
        candidate.tickIntervalMs = runtimeConfig.tickIntervalMs;
        const message = error instanceof Error ? error.message : String(error);
        updateResultForKey("tickIntervalMs", pending, false, message);
      }
    }

    if (agent && changedKeys.has("loopEnabled")) {
      if (candidate.loopEnabled) {
        agent.ticker.start();
      } else {
        agent.ticker.stop();
      }
      updateResultForKey("loopEnabled", pending, true, "Updated live loop state");
    }

    if (agent && (changedKeys.has("modelProvider") || changedKeys.has("modelId"))) {
      try {
        const nextModel = (getModel as Function)(candidate.modelProvider, candidate.modelId);
        agent.agent.setModel(nextModel);
        if (typeof (agent.agent as any).setThinkingLevel === "function") {
          (agent.agent as any).setThinkingLevel(nextModel.reasoning ? "medium" : "off");
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

    if (agent && changedKeys.has("dataDir")) {
      try {
        agent.setDataDir(candidate.dataDir);
        updateResultForKey("dataDir", pending, true, "Updated live data directory");
      } catch (error) {
        candidate.dataDir = runtimeConfig.dataDir;
        const message = error instanceof Error ? error.message : String(error);
        updateResultForKey("dataDir", pending, false, message);
      }
    }

    deps.setConfig(candidate);

    if (reason) {
      deps.onMessage?.(`Applied runtime config changes (${reason})`);
    }

    return {
      ok: results.every((result) => result.applied),
      results,
      currentConfig: { ...candidate },
    };
  };

  return {
    getConfig: () => ({ ...deps.getConfig() }),
    applyChanges(changes, reason) {
      const run = () => applyChangesInternal(changes, reason);
      applyQueue = applyQueue.then(run, run);
      return applyQueue;
    },
  };
}
