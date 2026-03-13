import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import type { EternumClient } from "@bibliothecadao/client";
import type { EternumProvider } from "@bibliothecadao/provider";
import type { GameConfig } from "@bibliothecadao/torii";
import type { AccountInterface } from "starknet";
import { join } from "node:path";

import type { MapContext } from "../map/context.js";
import type { TxContext } from "../tools/tx-context.js";
import { buildGameStateBlock, type ToolError } from "../entry/game-state.js";
import { buildSystemPrompt } from "../entry/soul.js";
import { evolve, type EvolutionSnapshot } from "../entry/evolution.js";
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
  const toolErrors: ToolError[] = [];

  const militaryDataDir = join(config.dataDir, "military");
  const productionDataDir = join(config.dataDir, "production");

  const convertToLlm = (messages: AgentMessage[]): Message[] =>
    messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");

  const militaryTools: AgentTool[] = [
    ...createReadOnlyTools(militaryDataDir),
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
    ...createReadOnlyTools(productionDataDir),
    createInspectTool(client, mapCtx, account.address),
    createTransferResourcesTool(client, mapCtx, account.address, txCtx),
    ...createAllProductionTools(txCtx, directives),
  ];

  const militaryMaxChars = (config.militaryModel.contextWindow ?? 200_000) * 3;
  const militaryPruneTarget = Math.floor(militaryMaxChars * 0.5);

  const militaryAgent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(militaryDataDir),
      model: config.militaryModel,
      thinkingLevel: config.militaryModel.reasoning ? "medium" : "off",
      tools: militaryTools,
      messages: [],
    },
    convertToLlm,
    followUpMode: "one-at-a-time",
    transformContext: async (messages: AgentMessage[]) => {
      const gameState = buildGameStateBlock(mapCtx, new Map(), toolErrors);
      militaryAgent.setSystemPrompt(buildSystemPrompt(militaryDataDir) + "\n\n" + gameState);
      return pruneMessages(messages, config.militaryModel, militaryMaxChars, militaryPruneTarget);
    },
  });

  const productionMaxChars = (config.productionModel.contextWindow ?? 200_000) * 3;
  const productionPruneTarget = Math.floor(productionMaxChars * 0.5);

  const productionAgent = new Agent({
    initialState: {
      systemPrompt: buildSystemPrompt(productionDataDir),
      model: config.productionModel,
      thinkingLevel: "off",
      tools: productionTools,
      messages: [],
    },
    convertToLlm,
    followUpMode: "one-at-a-time",
    transformContext: async (messages: AgentMessage[]) => {
      const gameState = buildGameStateBlock(mapCtx, new Map(), toolErrors);
      productionAgent.setSystemPrompt(buildSystemPrompt(productionDataDir) + "\n\n" + gameState);
      return pruneMessages(messages, config.productionModel, productionMaxChars, productionPruneTarget);
    },
  });

  let militaryBusy = false;
  let productionBusy = false;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let tickCount = 0;
  let evolving = false;
  const EVOLUTION_INTERVAL = 10;

  function buildEvolutionSnapshot(agent: Agent): EvolutionSnapshot {
    return {
      map: mapCtx.snapshot?.text ?? "Map not loaded",
      structures: "N/A (multi-agent mode)",
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
    };
  }

  function runEvolution() {
    if (evolving) return;
    evolving = true;

    const militarySnapshot = buildEvolutionSnapshot(militaryAgent);
    const productionSnapshot = buildEvolutionSnapshot(productionAgent);

    Promise.all([
      evolve(config.militaryModel, militaryDataDir, militarySnapshot).catch((err) =>
        console.error("[MILITARY] evolution error:", err instanceof Error ? err.message : err),
      ),
      evolve(config.productionModel, productionDataDir, productionSnapshot).catch((err) =>
        console.error("[PRODUCTION] evolution error:", err instanceof Error ? err.message : err),
      ),
    ]).finally(() => {
      evolving = false;
    });
  }

  function buildMilitaryTickPrompt(): string {
    const mapText = mapCtx.snapshot?.text ?? "Map not yet loaded.";
    const gameState = buildGameStateBlock(mapCtx, new Map(), toolErrors);
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
    const gameState = buildGameStateBlock(mapCtx, new Map(), toolErrors);
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
      runMilitaryTick();
      setTimeout(() => runProductionTick(), 2000);

      tickTimer = setInterval(() => {
        tickCount++;

        if (tickCount % EVOLUTION_INTERVAL === 0) {
          runEvolution();
        }

        runMilitaryTick();
        setTimeout(() => runProductionTick(), 2000);
      }, config.tickIntervalMs);

      console.log(
        `[COORDINATOR] Multi-agent system started. ` +
          `Military: ${config.militaryModel.id}, Production: ${config.productionModel.id}, ` +
          `Tick: ${config.tickIntervalMs / 1000}s, Evolution every ${EVOLUTION_INTERVAL} ticks`,
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
