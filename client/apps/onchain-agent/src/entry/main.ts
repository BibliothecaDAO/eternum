/**
 * Entry point for the Eternum autonomous agent.
 *
 * Config → Auth → EternumClient → Tools → Agent → Tick loop.
 * Uses pi-agent-core directly (no game-agent framework).
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { getModel, completeSimple } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import { EternumClient } from "@bibliothecadao/client";
import { EternumProvider } from "@bibliothecadao/provider";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { loadConfig } from "./config.js";
import { discoverWorld, patchManifest } from "../world/discovery.js";
import { bootstrapDataDir } from "./bootstrap.js";
import { buildSystemPrompt } from "./soul.js";
import { evolve } from "./evolution.js";
import { getAccount } from "../auth/session.js";
import { manifestPath } from "../auth/policies.js";
import { createMapLoop } from "../map/loop.js";
import { createAutomationLoop } from "../automation/loop.js";
import type { MapContext } from "../map/context.js";
import type { TxContext } from "../tools/tx-context.js";
import { createInspectTool } from "../tools/inspect.js";
import { createMoveTool } from "../tools/move.js";
import { createAttackTool } from "../tools/attack.js";
import { createCreateArmyTool } from "../tools/create-army.js";
import { createOpenChestTool } from "../tools/open-chest.js";
import { createViewMapTool } from "../tools/view-map.js";

// ---------------------------------------------------------------------------
// Context pruning — when messages exceed MAX_CONTEXT_CHARS, drops older
// messages and uses the agent's model to summarize what was lost.
// ---------------------------------------------------------------------------

const MAX_CONTEXT_CHARS = 400_000;
const PRUNE_TARGET_CHARS = 200_000;

function estimateChars(messages: AgentMessage[]): number {
  let total = 0;
  for (const m of messages) {
    const msg = m as Message;
    if (typeof msg.content === "string") {
      total += msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ("text" in block) total += block.text.length;
      }
    }
  }
  return total;
}

function splitMessages(messages: AgentMessage[]): { dropped: AgentMessage[]; kept: AgentMessage[] } {
  let kept = 0;
  let cutIndex = messages.length;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i] as Message;
    let chars = 0;
    if (typeof msg.content === "string") {
      chars = msg.content.length;
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if ("text" in block) chars += block.text.length;
      }
    }
    kept += chars;
    if (kept > PRUNE_TARGET_CHARS) {
      cutIndex = i + 1;
      break;
    }
  }

  if (cutIndex >= messages.length) cutIndex = messages.length - 1;
  return {
    dropped: messages.slice(0, cutIndex),
    kept: messages.slice(cutIndex),
  };
}

async function pruneMessages(messages: AgentMessage[], model: Model<any>): Promise<AgentMessage[]> {
  if (estimateChars(messages) <= MAX_CONTEXT_CHARS) return messages;

  const { dropped, kept } = splitMessages(messages);
  if (dropped.length === 0) return kept;

  // Summarize dropped messages using the agent's model
  const droppedLlm = dropped.filter(
    (m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
  );

  let summary = `[Context compacted: ${dropped.length} older messages dropped.]`;
  try {
    const result = await completeSimple(model, {
      systemPrompt:
        "Summarize this conversation history in 2-3 paragraphs. Focus on: strategic decisions made, " +
        "current military positions, resource state, ongoing plans, and any threats identified. " +
        "Be specific about coordinates, entity names, and outcomes.",
      messages: [
        {
          role: "user" as const,
          content: droppedLlm
            .map((m) => {
              const text =
                typeof m.content === "string"
                  ? m.content
                  : Array.isArray(m.content)
                    ? m.content
                        .filter((b): b is { type: "text"; text: string } => "text" in b)
                        .map((b) => b.text)
                        .join("\n")
                    : "";
              return `[${m.role}]: ${text}`;
            })
            .join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    });

    const text = result.content.find((b): b is { type: "text"; text: string } => b.type === "text");
    if (text) {
      summary = `[Context compacted: ${dropped.length} older messages summarized]\n\n${text.text}`;
    }
  } catch (err) {
    console.error("Compaction summary failed, using fallback:", err instanceof Error ? err.message : err);
    summary += " Use inspect and the map to re-orient.";
  }

  kept.unshift({
    role: "user" as const,
    content: summary,
    timestamp: Date.now(),
  } as AgentMessage);

  return kept;
}

// ---------------------------------------------------------------------------
// Tick prompt builder
// ---------------------------------------------------------------------------

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
    console.log(`  Resolved ${Object.keys(info.contractsBySelector).length} contract addresses from factory`);
  }

  bootstrapDataDir(config.dataDir);

  // Load and patch manifest before auth so session policies use the correct
  // contract addresses for this world (factory-discovered addresses differ
  // from the base mainnet manifest).
  let manifest = JSON.parse(readFileSync(manifestPath(config.chain), "utf-8"));
  if (contractsBySelector) {
    manifest = patchManifest(manifest, config.worldAddress, contractsBySelector);
  }

  console.log(`Eternum Agent starting...`);
  console.log(`  Chain: ${config.chain}`);
  console.log(`  World: ${config.worldAddress}`);
  console.log(`  Data: ${config.dataDir}`);
  console.log(`  Model: ${config.modelProvider}/${config.modelId}`);
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

  // 4. Tools — game-specific + read/grep/find/ls scoped to dataDir
  const tools: AgentTool[] = [
    ...createReadOnlyTools(config.dataDir),
    createInspectTool(client, mapCtx),
    createMoveTool(client, mapCtx, account.address, txCtx, gameConfig),
    createAttackTool(client, mapCtx, account.address, txCtx, gameConfig),
    createCreateArmyTool(client, mapCtx, account.address, txCtx),
    createOpenChestTool(client, mapCtx, account.address, txCtx),
    createViewMapTool(mapCtx),
  ];

  // 5. System prompt
  const systemPrompt = buildSystemPrompt(config.dataDir);

  // 6. Agent — uses followUp with one-at-a-time mode so tick messages
  //    queue safely without interrupting in-progress tool calls.
  const model = (getModel as Function)(config.modelProvider, config.modelId) as Model<any>;

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
      agent.setSystemPrompt(buildSystemPrompt(config.dataDir));
      return pruneMessages(messages, model);
    },
  });

  // 6b. Log agent events so we can see what the LLM is doing
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
        break;
      }
      case "message_end": {
        const msg = event.message as any;
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
  const mapLoop = createMapLoop(client, mapCtx, account.address, undefined, gameConfig.stamina);
  mapLoop.start();
  mapCtx.refresh = () => mapLoop.refresh();

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

  // 7b. Automation loop — builds, upgrades, and produces across all owned realms
  const automationLoop = createAutomationLoop(
    client,
    provider,
    account,
    account.address,
    config.dataDir,
    mapCtx,
    gameConfig,
  );
  automationLoop.start();

  // 8. Tick loop — prompt() when idle, steer() when busy (matches game-agent pattern).
  const EVOLUTION_INTERVAL = 10; // evolve every N ticks
  let tickCount = 0;
  let evolving = false;
  let agentBusy = false;

  function runAgentTick() {
    if (agentBusy) {
      // Let the agent finish its current turn — the next prompt() will
      // include fresh map data. Steering mid-turn just kills in-flight
      // tool calls ("Skipped due to queued user message") and wastes work.
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
      evolve(model, config.dataDir)
        .catch((err) => console.error("Evolution error:", err instanceof Error ? err.message : err))
        .finally(() => {
          evolving = false;
        });
    }

    runAgentTick();
  }, config.tickIntervalMs);

  // Kick off the first turn immediately
  runAgentTick();

  console.log(`Agent running (tick every ${config.tickIntervalMs / 1000}s). Ctrl+C to stop.`);

  // 9. Graceful shutdown
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
