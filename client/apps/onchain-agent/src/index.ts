import { EternumClient } from "@bibliothecadao/client";
import { createHeartbeatLoop, createGameAgent, type HeartbeatJob } from "@bibliothecadao/game-agent";
import { getModel } from "@mariozechner/pi-ai";
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
import { createRuntimeConfigManager } from "./runtime-config";
import { seedDataDir } from "./cli";

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
    files = readdirSync(taskDir)
      .filter((f: string) => f.endsWith(".md"))
      .sort();
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
  const sessionBasePath = worldProfile ? path.join(config.sessionBasePath, worldProfile.name) : config.sessionBasePath;

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
  const tokenConfig = worldProfile
    ? {
        feeToken: worldProfile.feeTokenAddress,
        entryToken: worldProfile.entryTokenAddress,
        worldAddress: config.worldAddress,
      }
    : undefined;
  const adapter = new EternumGameAdapter(
    client,
    account as any,
    account.address,
    manifest as any,
    config.gameName,
    tokenConfig,
  );
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

    // Scope data dir per-world so debug logs land alongside world state
    runtimeConfig.dataDir = path.join(runtimeConfig.dataDir, selected.name);
    process.env.AGENT_DATA_DIR = runtimeConfig.dataDir;

    // Ensure world-scoped data dir is seeded (soul.md, HEARTBEAT.md, tasks/)
    seedDataDir(runtimeConfig.dataDir);
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

  const runtimeConfigManager = createRuntimeConfigManager({
    getConfig: () => runtimeConfig,
    setConfig: (c) => {
      runtimeConfig = c;
    },
    getAgent: () => runtimeAgent,
    onBackendKeysChanged: async (candidate, changedKeys) => {
      const nextServices = await createRuntimeServices(candidate, resolvedManifest, currentWorldProfile);
      adapter.setAdapter(nextServices.adapter);
      services.client.disconnect();
      services = nextServices;
    },
    onMessage: (msg) => systemMessage?.(msg),
  });

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
