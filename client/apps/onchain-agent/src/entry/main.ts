/**
 * Entry point for the Eternum autonomous agent.
 *
 * Wires config loading, world discovery, Cartridge auth, EternumClient/Provider,
 * all game tools, the map loop, the automation loop, context pruning, and the
 * tick-driven agent loop. Uses pi-agent-core directly (no game-agent framework).
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { getModel } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import { EternumClient } from "@bibliothecadao/client";
import { EternumProvider } from "@bibliothecadao/provider";
import { createInterface } from "node:readline";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "./config.js";
import { pruneMessages } from "./context-pruning.js";
import { getManifest } from "../auth/embedded-data.js";

// Suppress noisy provider logs (fee estimation failures, tx data warnings, wait spam)
{
  const _warn = console.warn;
  const _error = console.error;
  const _info = console.info;
  const providerNoise = (msg: string) =>
    msg.includes("[provider]") ||
    msg.includes("Failed to estimate invoke fee") ||
    msg.includes("Insufficient transaction data");
  console.warn = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _warn.apply(console, a);
  };
  console.error = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _error.apply(console, a);
  };
  console.info = (...a: any[]) => {
    if (!providerNoise(String(a[0]))) _info.apply(console, a);
  };
}
import { discoverWorld, patchManifest } from "../world/discovery.js";
import { bootstrapDataDir } from "./bootstrap.js";
import { buildSystemPrompt } from "./soul.js";
import { evolve } from "./evolution.js";
import { getAccount } from "../auth/session.js";
import { createX402Model } from "../providers/x402/index.js";
import { createMapLoop } from "../map/loop.js";
import { createAutomationLoop } from "../automation/loop.js";
import { createMultiAgentSystem } from "../multi-agent/coordinator.js";
import type { MapContext } from "../map/context.js";
import type { TxContext } from "../tools/tx-context.js";
import { createInspectTool } from "../tools/inspect.js";
import { createMoveTool } from "../tools/move.js";
import { createAttackTool } from "../tools/attack.js";
import { createCreateArmyTool } from "../tools/create-army.js";
import { createReinforceArmyTool } from "../tools/reinforce-army.js";
import { createDefendStructureTool } from "../tools/defend-structure.js";
import { createTransferResourcesTool } from "../tools/transfer-resources.js";
import { createOpenChestTool } from "../tools/open-chest.js";
import { createViewMapTool } from "../tools/view-map.js";
import {
  createGuardDeleteTool,
  createGuardExplorerSwapTool,
  createAttackGuardVsExplorerTool,
} from "../tools/guard-management.js";
import { createApplyRelicTool } from "../tools/relic.js";
import {
  createTroopTroopAdjacentTransferTool,
  createTroopStructureAdjacentTransferTool,
  createStructureTroopAdjacentTransferTool,
} from "../tools/adjacent-transfer.js";
import { createAllocateSharesTool } from "../tools/hyperstructure.js";
import { buildGameStateBlock, type ToolError } from "./game-state.js";
import type { AutomationStatusMap } from "../automation/status.js";

// ---------------------------------------------------------------------------
// Tick prompt builder
// ---------------------------------------------------------------------------

/**
 * Build the per-tick user prompt sent to the agent at the start of each turn,
 * embedding the current map snapshot.
 *
 * @param mapCtx - Shared map context holding the latest tile snapshot.
 * @returns The formatted tick prompt, including the rendered map text and
 *          strategic instructions for the turn.
 */
function buildTickPrompt(mapCtx: MapContext): string {
  const mapText = mapCtx.snapshot?.text ?? "Map not yet loaded.";
  return [
    "## Tick — New Turn",
    "",
    "Current map:",
    mapText,
    "",
    "Review your priorities and decide what to do this turn.",
    "You can move troops across multiple explored tiles in a single move_army call, but movement into unexplored territory is limited to 1 step at a time.",
    "Use inspect to examine targets, move_army to reposition, attack to engage, open_chest to claim relics, or create_army to build forces.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Bootstrap and run the Eternum autonomous agent.
 *
 * Runs the full startup sequence: load config, optionally discover the world
 * via the factory, authenticate with Cartridge, create `EternumClient` and
 * `EternumProvider`, wire all game tools, start the background map and
 * automation loops, then enter the tick loop on a fixed interval. Opens an
 * interactive stdin readline interface so an operator can message the agent at
 * runtime. Registers `SIGINT`/`SIGTERM` handlers for graceful shutdown.
 *
 * @throws If config is invalid (missing `WORLD_NAME` and explicit URL pair),
 *         world discovery fails (network/factory error), the manifest file is
 *         missing for the chain, Cartridge authentication fails or times out,
 *         or the Torii client/game config cannot be initialized.
 */
export async function main() {
  const config = loadConfig();

  // Auto-discover world if WORLD_NAME is set and explicit URLs are missing
  let contractsBySelector: Record<string, string> | undefined;
  if (config.worldName && (!config.toriiUrl || !config.worldAddress)) {
    console.log(`Discovering world "${config.worldName}" on ${config.chain}...`);
    const info = await discoverWorld(config.chain, config.worldName);
    config.toriiUrl = info.toriiUrl;
    config.worldAddress = info.worldAddress;
    config.rpcUrl = info.rpcUrl;
    contractsBySelector = info.contractsBySelector;
    // Re-resolve dataDir now that we have the world address
    config.dataDir = join(homedir(), ".axis", "worlds", info.worldAddress);
    console.log(`  Discovered: torii=${info.toriiUrl}, world=${info.worldAddress}`);
    console.log(`  RPC: ${info.rpcUrl}`);
    console.log(`  Resolved ${Object.keys(info.contractsBySelector).length} contract addresses from factory`);
  }

  bootstrapDataDir(config.dataDir);

  // Load and patch manifest before auth so session policies use the correct
  // contract addresses for this world (factory-discovered addresses differ
  // from the base mainnet manifest).
  let manifest = getManifest(config.chain);
  if (contractsBySelector) {
    manifest = patchManifest(manifest, config.worldAddress, contractsBySelector);
  }

  // Resolve model early so we can log the actual model ID
  const model =
    config.modelProvider === "x402"
      ? await createX402Model()
      : ((getModel as Function)(config.modelProvider, config.modelId) as Model<any>);

  console.log(`Eternum Agent starting...`);
  console.log(`  Chain: ${config.chain}`);
  console.log(`  World: ${config.worldAddress}`);
  console.log(`  Data: ${config.dataDir}`);
  console.log(`  Model: ${config.modelProvider}/${model.id}`);
  console.log(`  VRF: ${config.vrfProviderAddress.slice(0, 10)}...`);

  // 1. Auth — get a signed account (session stored in world dataDir)
  const account = await getAccount({
    chain: config.chain,
    rpcUrl: config.rpcUrl,
    chainId: config.chainId,
    basePath: join(config.dataDir, ".cartridge"),
    manifest,
  });
  console.log(`  Account: ${account.address}`);

  // 2. Create headless client (reads) + provider (writes)
  const client = await EternumClient.create({ toriiUrl: config.toriiUrl });
  const provider = new EternumProvider(manifest, config.rpcUrl, config.vrfProviderAddress);

  // 2b. Load game config from Torii (building costs, production recipes)
  const gameConfig = await (client.sql as any).fetchGameConfig();
  console.log(
    `  Game config: ${Object.keys(gameConfig.buildingCosts).length} buildings, ` +
      `${Object.keys(gameConfig.resourceFactories).length} recipes, ` +
      `cost scale ${gameConfig.buildingBaseCostPercentIncrease}`,
  );

  // 3. Shared contexts
  const mapFilePath = join(config.dataDir, "map.txt");
  const mapCtx: MapContext = { snapshot: null, filePath: mapFilePath };
  const txCtx: TxContext = { provider, signer: account };
  const automationStatus: AutomationStatusMap = new Map();
  const toolErrors: ToolError[] = [];

  // 4. Tools — game-specific + read/grep/find/ls scoped to dataDir
  const tools: AgentTool[] = [
    ...createReadOnlyTools(config.dataDir),
    createInspectTool(client, mapCtx, account.address),
    createMoveTool(client, mapCtx, account.address, txCtx, gameConfig),
    createAttackTool(client, mapCtx, account.address, txCtx, gameConfig),
    createCreateArmyTool(client, mapCtx, account.address, txCtx),
    createReinforceArmyTool(client, mapCtx, account.address, txCtx),
    createDefendStructureTool(client, mapCtx, account.address, txCtx),
    createTransferResourcesTool(client, mapCtx, account.address, txCtx),
    createOpenChestTool(client, mapCtx, account.address, txCtx),
    createViewMapTool(mapCtx),
    // Blitz-specific tools
    createGuardDeleteTool(client, mapCtx, account.address, txCtx),
    createGuardExplorerSwapTool(client, mapCtx, account.address, txCtx),
    createAttackGuardVsExplorerTool(client, mapCtx, account.address, txCtx),
    createApplyRelicTool(client, mapCtx, account.address, txCtx),
    createTroopTroopAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createTroopStructureAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createStructureTroopAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createAllocateSharesTool(client, mapCtx, account.address, txCtx),
  ];

  // 5. System prompt
  const systemPrompt = buildSystemPrompt(config.dataDir);

  // 6. Agent — uses followUp with one-at-a-time mode so tick messages
  //    queue safely without interrupting in-progress tool calls.
  const convertToLlm = (messages: AgentMessage[]): Message[] =>
    messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");

  const agent = new Agent({
    initialState: {
      systemPrompt,
      model,
      thinkingLevel: model.reasoning ? "medium" : "off",
      tools,
      messages: [],
    },
    convertToLlm,
    followUpMode: "one-at-a-time",
    transformContext: async (messages) => {
      const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
      agent.setSystemPrompt(buildSystemPrompt(config.dataDir) + "\n\n" + gameState);
      const maxChars = (model.contextWindow ?? 200_000) * 3;
      const pruneTarget = Math.floor(maxChars * 0.5);
      return pruneMessages(messages, model, maxChars, pruneTarget);
    },
  });

  // 6a. Log agent events so we can see what the LLM is doing
  agent.subscribe((event) => {
    switch (event.type) {
      case "agent_start":
        console.log("[AGENT] thinking...");
        break;
      case "tool_execution_start":
        console.log(`[AGENT] tool call: ${event.toolName}(${JSON.stringify(event.args).slice(0, 200)})`);
        break;
      case "tool_execution_end": {
        const resultText =
          event.result?.content
            ?.filter((b: any) => b.type === "text")
            ?.map((b: any) => b.text)
            ?.join("")
            ?.slice(0, 300) ?? "";
        console.log(`[AGENT] tool result: ${event.toolName} ${event.isError ? "ERROR" : "ok"} — ${resultText}`);
        if (event.isError) {
          const errorText =
            event.result?.content
              ?.filter((b: any) => b.type === "text")
              ?.map((b: any) => b.text)
              ?.join("")
              ?.slice(0, 100) ?? "unknown error";
          toolErrors.push({ tool: event.toolName, error: errorText, tick: tickCount });
          while (toolErrors.length > 20) toolErrors.shift();
        }
        break;
      }
      case "message_end": {
        const msg = event.message as any;
        if (msg.errorMessage) {
          console.error(`[AGENT] model error: ${msg.errorMessage}`);
        }
        if (msg.role === "assistant" && typeof msg.content === "string" && msg.content.length > 0) {
          console.log(`[AGENT] says: ${msg.content.slice(0, 300)}`);
        } else if (msg.role === "assistant" && Array.isArray(msg.content)) {
          const text = msg.content
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join("");
          if (text.length > 0) console.log(`[AGENT] says: ${text.slice(0, 300)}`);
        }
        break;
      }
      case "agent_end":
        console.log("[AGENT] turn complete");
        break;
    }
  });

  // 7. Map loop — refreshes tile data in the background
  let onThreatCallback: ((alerts: any[]) => void) | null = null;
  const mapLoop = createMapLoop(client, mapCtx, account.address, undefined, gameConfig.stamina, (alerts) => {
    if (onThreatCallback) onThreatCallback(alerts);
  });
  mapLoop.start();
  mapCtx.refresh = () => mapLoop.refresh();

  // Wire threat detection — agent.steer() pushes urgent defensive alerts
  onThreatCallback = (alerts) => {
    const anchor = mapCtx.snapshot?.anchor;
    if (!anchor) return;
    for (const alert of alerts) {
      const eRow = anchor.maxY - alert.enemyY + 1;
      const eCol = alert.enemyX - anchor.minX + 1;
      const sRow = anchor.maxY - alert.structureY + 1;
      const sCol = alert.structureX - anchor.minX + 1;
      const msg = `DEFENSIVE ALERT: Enemy army detected at ${eRow}:${eCol}, adjacent to your structure at ${sRow}:${sCol}. Assess threat and respond.`;
      console.log(`[THREAT] ${msg}`);
      agent.steer({ role: "user", content: msg, timestamp: Date.now() } as AgentMessage);
    }
  };

  // Wait for first map load before starting the agent — otherwise the LLM
  // gets "Map not yet loaded" and wastes its first turn guessing coordinates.
  console.log("Waiting for first map load...");
  for (let i = 0; i < 30; i++) {
    if (mapCtx.snapshot) break;
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (mapCtx.snapshot) {
    console.log(
      `  Map loaded: ${mapCtx.snapshot.rowCount} rows x ${mapCtx.snapshot.colCount} cols, ${mapCtx.snapshot.tiles.length} tiles`,
    );
  } else {
    console.log("  WARNING: Map failed to load within 30s, starting agent anyway");
  }

  // 7b. Multi-agent vs single-agent path
  if (config.multiAgent) {
    const productionModel =
      config.productionModelProvider === "x402"
        ? await createX402Model()
        : ((getModel as Function)(config.productionModelProvider, config.productionModelId) as Model<any>);

    console.log(`  Multi-agent mode: military=${model.id}, production=${productionModel.id}`);

    const multiAgent = createMultiAgentSystem(
      {
        militaryModel: model,
        productionModel,
        tickIntervalMs: config.tickIntervalMs,
        dataDir: config.dataDir,
      },
      client,
      provider,
      account,
      mapCtx,
      gameConfig,
    );

    onThreatCallback = (alerts) => {
      const anchor = mapCtx.snapshot?.anchor;
      if (!anchor) return;
      for (const alert of alerts) {
        const eRow = anchor.maxY - alert.enemyY + 1;
        const eCol = alert.enemyX - anchor.minX + 1;
        const sRow = anchor.maxY - alert.structureY + 1;
        const sCol = alert.structureX - anchor.minX + 1;
        const msg = `DEFENSIVE ALERT: Enemy army detected at ${eRow}:${eCol}, adjacent to your structure at ${sRow}:${sCol}. Assess threat and respond.`;
        console.log(`[THREAT] ${msg}`);
        multiAgent.militaryAgent.steer({ role: "user", content: msg, timestamp: Date.now() } as AgentMessage);
      }
    };

    multiAgent.start();

    console.log(
      `Multi-agent system running (tick every ${config.tickIntervalMs / 1000}s). ` +
        `Military handles combat/map, Production handles economy. Ctrl+C to stop.`,
    );

    const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
    rl.prompt();
    rl.on("line", (line) => {
      const text = line.trim();
      if (!text) {
        rl.prompt();
        return;
      }
      console.log("[YOU → military agent]");
      multiAgent.militaryAgent.steer({ role: "user" as const, content: text, timestamp: Date.now() } as AgentMessage);
      rl.prompt();
    });

    const shutdown = () => {
      console.log("\nShutting down multi-agent system...");
      multiAgent.dispose();
      mapLoop.stop();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return;
  }

  // 7c. Single-agent mode — automation loop + single LLM agent
  const automationLoop = createAutomationLoop(
    client,
    provider,
    account,
    account.address,
    config.dataDir,
    mapCtx,
    gameConfig,
    undefined,
    automationStatus,
  );
  automationLoop.start();

  // 8. Tick loop — prompt() when idle, steer() when busy (matches game-agent pattern).
  const EVOLUTION_INTERVAL = 10;
  let tickCount = 0;
  let evolving = false;
  let agentBusy = false;

  function runAgentTick() {
    if (agentBusy) {
      return;
    }
    const prompt = buildTickPrompt(mapCtx);
    agentBusy = true;
    agent.prompt(prompt).then(
      () => {
        agentBusy = false;
      },
      (err) => {
        agentBusy = false;
        console.error("Agent error:", err instanceof Error ? err.message : err);
      },
    );
  }

  const tickTimer = setInterval(() => {
    tickCount++;

    if (tickCount % EVOLUTION_INTERVAL === 0 && !evolving) {
      evolving = true;
      evolve(model, config.dataDir, {
        map: mapCtx.snapshot?.text ?? "Map not loaded",
        structures:
          [...automationStatus.values()]
            .map(
              (s) =>
                `${s.name} | lv${s.level} | build ${s.buildOrderProgress} | Wheat: ${s.wheatBalance}, Essence: ${s.essenceBalance}`,
            )
            .join("\n") || "No structures",
        armies: mapCtx.snapshot?.explorerDetails
          ? [...mapCtx.snapshot.explorerDetails.entries()]
              .map(
                ([id, info]: [number, any]) =>
                  `army ${id} | ${info.troopCount?.toLocaleString() ?? "?"} ${info.troopType ?? "?"} ${info.troopTier ?? "?"}`,
              )
              .join("\n")
          : "No armies",
        toolErrors: toolErrors.map((e) => `${e.tool}: ${e.error}`).join("\n") || "None",
        recentMessages: (agent as any).state?.messages?.slice(-30),
        timestamp: Date.now(),
      })
        .catch((err) => console.error("Evolution error:", err instanceof Error ? err.message : err))
        .finally(() => {
          evolving = false;
        });
    }

    runAgentTick();
  }, config.tickIntervalMs);

  runAgentTick();

  console.log(
    `Agent running (tick every ${config.tickIntervalMs / 1000}s). Type a message to talk to the agent. Ctrl+C to stop.`,
  );

  // 9. Interactive stdin — send messages to the agent
  const rl = createInterface({ input: process.stdin, output: process.stdout, prompt: "> " });
  rl.prompt();
  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) {
      rl.prompt();
      return;
    }
    if (agentBusy) {
      console.log("[YOU → steering] (interrupting current turn)");
      agent.steer({ role: "user" as const, content: text, timestamp: Date.now() } as AgentMessage);
    } else {
      console.log("[YOU → prompt]");
      agentBusy = true;
      agent.prompt(text).then(
        () => {
          agentBusy = false;
          rl.prompt();
        },
        (err) => {
          agentBusy = false;
          console.error("Agent error:", err instanceof Error ? err.message : err);
          rl.prompt();
        },
      );
    }
    rl.prompt();
  });

  // 10. Graceful shutdown
  const shutdown = () => {
    console.log("\nShutting down...");
    clearInterval(tickTimer);
    mapLoop.stop();
    automationLoop.stop();
    agent.abort();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
