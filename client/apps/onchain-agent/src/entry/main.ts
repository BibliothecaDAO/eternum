/**
 * Entry point for the Eternum autonomous agent.
 *
 * Orchestrates the full startup and run sequence: config -> world discovery ->
 * Cartridge auth -> EternumClient/Provider -> game tools -> map loop ->
 * automation loop -> context pruning -> tick-driven agent loop.
 *
 * Uses pi-agent-core directly (no game-agent framework).
 *
 * @module
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { getModel, completeSimple } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import { createInterface } from "node:readline";

import { bootstrap } from "./bootstrap-runtime.js";
import { buildSystemPrompt } from "./soul.js";
import { evolve } from "./evolution.js";
import { createX402Model } from "../providers/x402/index.js";
import type { MapContext } from "../map/context.js";
import { createCoreTools } from "../tools/pi-tools.js";

/** A tool invocation that failed during an agent turn. */
interface ToolError {
  tool: string;
  error: string;
  tick: number;
}

// ── Context pruning ─────────────────────────────────────────────────
// When messages exceed a character threshold, older messages are dropped
// and summarized by the agent's model to preserve situational awareness.

/**
 * Estimate total character count across all messages.
 *
 * @param messages - Current agent message history.
 * @returns Approximate character count (text blocks only).
 */
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

/**
 * Split messages into `dropped` (oldest) and `kept` (most recent) slices,
 * keeping at most `target` characters in the retained portion.
 *
 * @param messages - Full message history, oldest first.
 * @param target - Maximum characters to retain (default 200 000).
 * @returns `{ dropped, kept }` — oldest messages to summarize and newest to preserve.
 */
function splitMessages(
  messages: AgentMessage[],
  target: number = 200_000,
): { dropped: AgentMessage[]; kept: AgentMessage[] } {
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
    if (kept > target) {
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

/**
 * Prune message history when it exceeds `maxChars`.
 *
 * Drops the oldest messages, summarizes them via `model`, and prepends
 * the summary as a synthetic `"user"` message so the agent retains
 * situational awareness. Falls back to a short placeholder if
 * summarization fails.
 *
 * @param messages - Current message history to potentially compact.
 * @param model - Language model used to generate the compaction summary.
 * @param maxChars - Trigger threshold; no pruning if total characters are below this.
 * @param pruneTarget - Character budget for the retained portion after pruning.
 * @returns The (possibly pruned and prepended) message array.
 */
async function pruneMessages(
  messages: AgentMessage[],
  model: Model<any>,
  maxChars: number = 400_000,
  pruneTarget: number = 200_000,
): Promise<AgentMessage[]> {
  if (estimateChars(messages) <= maxChars) return messages;

  const { dropped, kept } = splitMessages(messages, pruneTarget);
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

// ── Tick prompt builder ─────────────────────────────────────────────

/**
 * Build the per-tick user prompt sent to the agent at the start of each turn.
 *
 * Embeds the protocol briefing (armies, structures, threats, opportunities)
 * and reminds the agent of its available actions.
 *
 * @param mapCtx - Shared map context holding the latest protocol and snapshot.
 * @returns Formatted tick prompt ready to pass to `agent.prompt()`.
 */
function buildTickPrompt(mapCtx: MapContext): string {
  const briefing = mapCtx.protocol?.briefing() ?? "Map not yet loaded.";
  return [
    "## Tick — New Turn",
    "",
    briefing,
    "",
    "Review your priorities and decide what to do this turn.",
    "Use map_query to explore the world: tile_info, nearby, entity_info, find.",
    "Use move_army to reposition, attack to engage, open_chest to claim relics, or create_army to build forces.",
  ].join("\n");
}

// ── Main ────────────────────────────────────────────────────────────

/**
 * Bootstrap and run the Eternum autonomous agent.
 *
 * Startup sequence:
 * 1. Load config and optionally discover the world via the factory.
 * 2. Authenticate with Cartridge and create `EternumClient` / `EternumProvider`.
 * 3. Wire all game tools (inspect, move, attack, create army, etc.).
 * 4. Start the background map and automation loops.
 * 5. Enter the tick-driven agent loop on a fixed interval.
 * 6. Open an interactive stdin readline for operator messages.
 * 7. Register `SIGINT`/`SIGTERM` handlers for graceful shutdown.
 *
 * @throws {Error} If config is invalid, world discovery fails, the manifest
 *   is missing, Cartridge auth times out, or the Torii client cannot initialize.
 */
export async function main() {
  const { config, client, account, gameConfig, mapCtx, mapLoop, automationLoop, automationStatus, toolCtx } =
    await bootstrap();

  // Resolve model (axis run-specific — not part of shared bootstrap)
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

  const toolErrors: ToolError[] = [];

  // 4. Tools — core tools + read/grep/find/ls scoped to dataDir
  const tools: AgentTool[] = [...createReadOnlyTools(config.dataDir), ...createCoreTools(toolCtx, mapCtx)];

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
      // Keep toolCtx.snapshot in sync with the latest map data each tick
      if (mapCtx.snapshot) toolCtx.snapshot = mapCtx.snapshot;
      const briefing = mapCtx.protocol?.briefing() ?? "";
      const errorBlock =
        toolErrors.length > 0
          ? "\n<tool_errors>\n" + toolErrors.map((e) => `  ${e.tool}: ${e.error}`).join("\n") + "\n</tool_errors>"
          : "";
      agent.setSystemPrompt(buildSystemPrompt(config.dataDir) + "\n\n" + briefing + errorBlock);
      const maxChars = (model.contextWindow ?? 200_000) * 3;
      const pruneTarget = Math.floor(maxChars * 0.5);
      return pruneMessages(messages, model, maxChars, pruneTarget);
    },
  });

  // 6a. Log agent events so we can see what the LLM is doing
  let tickCount = 0;
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

  // Start automation loop
  automationLoop.start();

  // 8. Tick loop — prompt() when idle, steer() when busy (matches game-agent pattern).
  const EVOLUTION_INTERVAL = 10; // evolve every N ticks
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
      evolve(model, config.dataDir, {
        map: mapCtx.protocol?.briefing() ?? "Map not loaded",
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

  // Kick off the first turn immediately
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
