import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { AccountInterface } from "starknet";

import type { MapContext } from "../map/context.js";
import type { TxContext } from "../tools/tx-context.js";
import type { AutomationStatusMap } from "../automation/status.js";
import { buildGameStateBlock, type ToolError } from "../entry/game-state.js";
import { buildSystemPrompt } from "../entry/soul.js";
import { pruneMessages } from "../entry/context-pruning.js";

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

import { DirectiveQueue } from "./directives.js";
import { createAllProductionTools } from "./production-tools.js";
import { createAllMilitaryDelegationTools } from "./military-tools.js";

const MILITARY_SOUL = `You are the MILITARY commander of an Eternum Blitz game.

Your responsibilities:
- Map control: scouting, exploration, army positioning
- Combat: attacking enemies, capturing structures, defending with guards
- Defense: guarding structures, using guard_delete/guard_explorer_swap to reposition garrisons
- Relic management: opening chests, transferring relics (adjacent transfers), applying relics
- Hyperstructure control: capturing and allocating shares (allocate_shares) immediately after capture

You DO NOT handle production, building, or economy. That's the production agent's job.
When you need troops, use request_troops. When you need resources for your armies, use request_resources.
Use set_production_priority for strategic direction (e.g. "focus on Paladins — biome advantage").
Use view_production_status to check on production progress.

Combat tips:
- Always use inspect before attacking to assess enemy strength
- Knights beat Crossbowmen, Crossbowmen beat Paladins, Paladins beat Knights
- Biome matters: check which troop type has advantage in the tile's biome
- Stamina: 50 to attack, 30 to explore, 10 to travel. Regenerates 20/min.
- Guard structures with at least one guard slot before leaving them undefended
- Use attack_guard_vs_explorer to defend structures without moving armies
- After capturing a hyperstructure, ALWAYS call allocate_shares to claim 100% ownership

Relic workflow:
1. Open relic chest (open_chest) — relic appears on your explorer
2. Move explorer adjacent to target structure
3. Transfer relic: troop_structure_adjacent_transfer to deposit relic on structure
4. Apply relic: apply_relic on the structure to activate the bonus

Strategy:
- Explore aggressively early to find relic chests and enemy positions
- Capture hyperstructures for points, allocate shares immediately
- Use adjacent transfers to manage relics between armies and structures
- Coordinate with production: request troops before you need them`;

const PRODUCTION_SOUL = `You are the PRODUCTION quartermaster of an Eternum Blitz game.

Your responsibilities:
- Build and manage buildings across all owned realms
- Produce resources (Wood, Coal, Copper, Ironwood, Gold, ColdIron, Mithral, Adamantine, Dragonhide)
- Produce troops as requested by the military commander
- Transfer resources between realms
- Upgrade realms to unlock more building slots
- Offload resource arrivals from incoming transfers
- Pause/resume production at buildings to manage resource flow

You DO NOT move armies, fight, or explore. That's the military commander's job.

Each tick, check for pending military requests and prioritize them:
1. URGENT troop/resource requests (military is under attack)
2. NORMAL troop/resource requests (strategic buildup)
3. Priority directives (strategic direction like "focus paladins")
4. Autonomous optimization (upgrades, production efficiency)

Building priority:
1. Wheat farms first (everything needs Wheat)
2. Labor buildings
3. Resource buildings for the troop production chain
4. Military buildings (troop type matching the priority directive)
5. WorkersHuts when population is the bottleneck

Production chains:
- T1 troops: needs base resources (Wood, Coal, Copper)
- T2 troops: needs mid resources (Ironwood/ColdIron/Gold) + Essence + T1 troops
- T3 troops: needs rare resources (Adamantine/Mithral/Dragonhide) + Essence + T2 troops

Use mark_request_status to update the military on progress.
Mark requests 'in_progress' when you start working on them, 'done' when fulfilled.`;

export interface MultiAgentConfig {
  militaryModel: Model<any>;
  productionModel: Model<any>;
  tickIntervalMs: number;
  dataDir: string;
}

export interface MultiAgentSystem {
  militaryAgent: Agent;
  productionAgent: Agent;
  directives: DirectiveQueue;
  start(): void;
  stop(): void;
  dispose(): void;
}

export function createMultiAgentSystem(
  config: MultiAgentConfig,
  client: EternumClient,
  provider: EternumProvider,
  account: AccountInterface,
  mapCtx: MapContext,
  gameConfig: GameConfig,
): MultiAgentSystem {
  const txCtx: TxContext = { provider, signer: account };
  const directives = new DirectiveQueue();
  const automationStatus: AutomationStatusMap = new Map();
  const toolErrors: ToolError[] = [];

  const convertToLlm = (messages: AgentMessage[]): Message[] =>
    messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");

  const militaryTools: AgentTool[] = [
    ...createReadOnlyTools(config.dataDir),
    createInspectTool(client, mapCtx, account.address),
    createMoveTool(client, mapCtx, account.address, txCtx, gameConfig),
    createAttackTool(client, mapCtx, account.address, txCtx, gameConfig),
    createCreateArmyTool(client, mapCtx, account.address, txCtx),
    createReinforceArmyTool(client, mapCtx, account.address, txCtx),
    createDefendStructureTool(client, mapCtx, account.address, txCtx),
    createOpenChestTool(client, mapCtx, account.address, txCtx),
    createViewMapTool(mapCtx),
    createGuardDeleteTool(client, mapCtx, account.address, txCtx),
    createGuardExplorerSwapTool(client, mapCtx, account.address, txCtx),
    createAttackGuardVsExplorerTool(client, mapCtx, account.address, txCtx),
    createApplyRelicTool(client, mapCtx, account.address, txCtx),
    createTroopTroopAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createTroopStructureAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createStructureTroopAdjacentTransferTool(client, mapCtx, account.address, txCtx),
    createAllocateSharesTool(client, mapCtx, account.address, txCtx),
    ...createAllMilitaryDelegationTools(directives),
  ];

  const productionTools: AgentTool[] = [
    ...createReadOnlyTools(config.dataDir),
    createInspectTool(client, mapCtx, account.address),
    createTransferResourcesTool(client, mapCtx, account.address, txCtx),
    ...createAllProductionTools(txCtx, directives),
  ];

  const militaryMaxChars = (config.militaryModel.contextWindow ?? 200_000) * 3;
  const militaryPruneTarget = Math.floor(militaryMaxChars * 0.5);

  const militaryAgent = new Agent({
    initialState: {
      systemPrompt: MILITARY_SOUL,
      model: config.militaryModel,
      thinkingLevel: config.militaryModel.reasoning ? "medium" : "off",
      tools: militaryTools,
      messages: [],
    },
    convertToLlm,
    followUpMode: "one-at-a-time",
    transformContext: async (messages: AgentMessage[]) => {
      const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
      militaryAgent.setSystemPrompt(MILITARY_SOUL + "\n\n" + gameState);
      return pruneMessages(messages, config.militaryModel, militaryMaxChars, militaryPruneTarget);
    },
  });

  const productionMaxChars = (config.productionModel.contextWindow ?? 200_000) * 3;
  const productionPruneTarget = Math.floor(productionMaxChars * 0.5);

  const productionAgent = new Agent({
    initialState: {
      systemPrompt: PRODUCTION_SOUL,
      model: config.productionModel,
      thinkingLevel: "off",
      tools: productionTools,
      messages: [],
    },
    convertToLlm,
    followUpMode: "one-at-a-time",
    transformContext: async (messages: AgentMessage[]) => {
      const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
      productionAgent.setSystemPrompt(PRODUCTION_SOUL + "\n\n" + gameState);
      return pruneMessages(messages, config.productionModel, productionMaxChars, productionPruneTarget);
    },
  });

  let militaryBusy = false;
  let productionBusy = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;

  function buildMilitaryTickPrompt(): string {
    const mapText = mapCtx.snapshot?.text ?? "Map not yet loaded.";
    const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
    const productionStatus = directives.formatForMilitary();

    return [
      "## Tick — New Turn (Military)",
      "",
      "Current map:",
      mapText,
      "",
      gameState,
      "",
      productionStatus,
      "",
      "Review the map, threats, and production status. Decide what to do this turn.",
    ].join("\n");
  }

  function buildProductionTickPrompt(): string {
    const gameState = buildGameStateBlock(mapCtx, automationStatus, toolErrors);
    const militaryRequests = directives.formatForProduction();

    return [
      "## Tick — New Turn (Production)",
      "",
      gameState,
      "",
      militaryRequests,
      "",
      "Check military requests and manage your realms. Build, produce, transfer, upgrade as needed.",
    ].join("\n");
  }

  function runMilitaryTick() {
    if (militaryBusy) return;
    militaryBusy = true;
    const prompt = buildMilitaryTickPrompt();
    militaryAgent.prompt(prompt).then(
      () => {
        militaryBusy = false;
      },
      (err: unknown) => {
        militaryBusy = false;
        console.error("[MILITARY] error:", err instanceof Error ? err.message : err);
      },
    );
  }

  function runProductionTick() {
    if (productionBusy) return;
    productionBusy = true;
    const prompt = buildProductionTickPrompt();
    productionAgent.prompt(prompt).then(
      () => {
        productionBusy = false;
        directives.clearCompleted();
      },
      (err: unknown) => {
        productionBusy = false;
        console.error("[PRODUCTION] error:", err instanceof Error ? err.message : err);
      },
    );
  }

  function logAgentEvents(agent: Agent, name: string) {
    agent.subscribe((event: any) => {
      switch (event.type) {
        case "agent_start":
          console.log(`[${name}] thinking...`);
          break;
        case "tool_execution_start":
          console.log(`[${name}] tool: ${event.toolName}(${JSON.stringify(event.args).slice(0, 200)})`);
          break;
        case "tool_execution_end": {
          const text =
            event.result?.content
              ?.filter((b: any) => b.type === "text")
              ?.map((b: any) => b.text)
              ?.join("")
              ?.slice(0, 200) ?? "";
          console.log(`[${name}] result: ${event.toolName} ${event.isError ? "ERROR" : "ok"} — ${text}`);
          break;
        }
        case "message_end": {
          const msg = event.message as any;
          if (msg.role === "assistant") {
            const text =
              typeof msg.content === "string"
                ? msg.content
                : Array.isArray(msg.content)
                  ? msg.content
                      .filter((b: any) => b.type === "text")
                      .map((b: any) => b.text)
                      .join("")
                  : "";
            if (text.length > 0) console.log(`[${name}] says: ${text.slice(0, 300)}`);
          }
          break;
        }
        case "agent_end":
          console.log(`[${name}] turn complete`);
          break;
      }
    });
  }

  logAgentEvents(militaryAgent, "MILITARY");
  logAgentEvents(productionAgent, "PRODUCTION");

  return {
    militaryAgent,
    productionAgent,
    directives,

    start() {
      // Both agents tick on the same cadence, staggered by half
      // Military goes first, production follows
      runMilitaryTick();
      setTimeout(() => runProductionTick(), 2000);

      tickTimer = setInterval(() => {
        runMilitaryTick();
        setTimeout(() => runProductionTick(), 2000);
      }, config.tickIntervalMs);

      console.log(
        `[COORDINATOR] Multi-agent system started. ` +
          `Military: ${config.militaryModel.id}, Production: ${config.productionModel.id}, ` +
          `Tick: ${config.tickIntervalMs / 1000}s`,
      );
    },

    stop() {
      if (tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
      }
    },

    dispose() {
      this.stop();
      militaryAgent.abort();
      productionAgent.abort();
    },
  };
}
