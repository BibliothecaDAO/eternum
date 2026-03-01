import type { AgentMessage, AgentTool, StreamFn } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { createReadTool, createWriteTool } from "@mariozechner/pi-coding-agent";
import { existsSync } from "fs";
import { join } from "path";
import { createDecisionRecorder, type DecisionRecorder } from "./decision-log.js";
import { buildGamePrompt, loadSoul, loadTaskLists } from "./soul.js";
import { createTickLoop, formatTickPrompt, type TickLoop } from "./tick-loop.js";
import { createAgentConfigTools, createGameTools } from "./tools.js";
import type { ActionDefinition, GameAgentConfig, RuntimeConfigManager, WorldState } from "./types.js";

export interface GameAgentResult {
  agent: Agent;
  tools: AgentTool[];
  ticker: TickLoop;
  recorder: DecisionRecorder;
  enqueuePrompt(prompt: string): Promise<void>;
  reloadPrompt(): void;
  setDataDir(dataDir: string): void;
  getDataDir(): string;
  dispose(): Promise<void>;
}

export interface CreateGameAgentOptions<TState extends WorldState = WorldState> extends GameAgentConfig<TState> {
  /** Custom stream function (for testing with mocks) */
  streamFn?: StreamFn;
  /** Expose read/write tools scoped to dataDir. Default true. */
  includeDataTools?: boolean;
  /** Additional tools to append after built-ins. */
  extraTools?: AgentTool[];
  /** Optional runtime config manager exposed as get/set config tools. */
  runtimeConfigManager?: RuntimeConfigManager;
  /** Action definitions to constrain execute/simulate tools and enable list_actions. */
  actionDefs?: ActionDefinition[];
  /** Called when a tick errors. Defaults to console.error. */
  onTickError?: (err: Error) => void;
}

function buildSystemPromptFromDataDir(dataDir: string): string {
  const soulPath = join(dataDir, "soul.md");
  const soul = existsSync(soulPath) ? loadSoul(soulPath) : "You are an autonomous game agent.";

  const taskListDir = join(dataDir, "tasks");
  const taskLists = loadTaskLists(taskListDir);
  const { systemPrompt, appendSections } = buildGamePrompt({ soul, taskLists });
  return [systemPrompt, ...appendSections].join("\n\n");
}

export function createGameAgent<TState extends WorldState = WorldState>(
  options: CreateGameAgentOptions<TState>,
): GameAgentResult {
  const {
    adapter,
    model,
    tickIntervalMs = 60_000,
    streamFn,
    includeDataTools = true,
    extraTools = [],
    runtimeConfigManager,
    actionDefs,
    formatTickPrompt: customFormatTickPrompt,
    onTickError,
  } = options;
  let currentDataDir = options.dataDir;

  const buildTools = () => {
    // observe_game always gets full state (null prevState), not a diff
    const fullStateFormatter = customFormatTickPrompt
      ? (state: any) => customFormatTickPrompt(state, null)
      : undefined;
    const gameTools = createGameTools(adapter, actionDefs, fullStateFormatter);
    const fileTools = includeDataTools ? [createReadTool(currentDataDir), createWriteTool(currentDataDir)] : [];
    const configTools = runtimeConfigManager ? createAgentConfigTools(runtimeConfigManager) : [];
    return [...gameTools, ...fileTools, ...configTools, ...extraTools] as AgentTool[];
  };

  let allTools = buildTools();
  const fullSystemPrompt = buildSystemPromptFromDataDir(currentDataDir);

  // Create decision recorder
  const decisionLogDir = join(currentDataDir, "decisions");
  const recorder = createDecisionRecorder(decisionLogDir);

  // Default convertToLlm - filter to standard message types
  const convertToLlm = (messages: AgentMessage[]): Message[] => {
    return messages.filter((m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult");
  };

  /**
   * Context window management — prune old messages when context gets too large.
   * Keeps the most recent messages and always preserves the latest user message
   * (current world state). Estimates tokens as content.length / 4.
   */
  const MAX_CONTEXT_CHARS = 400_000; // ~100K tokens — leave headroom for model's limit
  const PRUNE_TARGET_CHARS = 200_000; // prune down to ~50K tokens

  const transformContext = async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
    // Estimate total context size
    let totalChars = 0;
    for (const m of messages) {
      const msg = m as Message;
      if (typeof msg.content === "string") {
        totalChars += msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ("text" in block) totalChars += block.text.length;
        }
      }
    }

    if (totalChars <= MAX_CONTEXT_CHARS) return messages;

    // Need to prune. Keep messages from the end until we hit the target.
    let kept = 0;
    let cutIndex = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i] as Message;
      let msgChars = 0;
      if (typeof msg.content === "string") {
        msgChars = msg.content.length;
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if ("text" in block) msgChars += block.text.length;
        }
      }
      kept += msgChars;
      if (kept > PRUNE_TARGET_CHARS) {
        cutIndex = i + 1;
        break;
      }
    }

    // Always keep at least the last message
    if (cutIndex >= messages.length) cutIndex = messages.length - 1;

    const pruned = messages.slice(cutIndex);

    // Inject a summary note so the agent knows history was trimmed
    const droppedCount = messages.length - pruned.length;
    if (droppedCount > 0) {
      // Reload system prompt from disk after compaction — picks up latest
      // learnings/priorities that may have been written since startup
      const freshPrompt = buildSystemPromptFromDataDir(currentDataDir);
      agent.setSystemPrompt(freshPrompt);

      pruned.unshift({
        role: "user" as const,
        content: `[Context compacted: ${droppedCount} older messages dropped. System prompt reloaded with latest task files. Use observe_game for current state.]`,
        timestamp: Date.now(),
      } as AgentMessage);
    }

    return pruned;
  };

  // Create agent
  const agentOptions: ConstructorParameters<typeof Agent>[0] = {
    initialState: {
      systemPrompt: fullSystemPrompt,
      model: model as Model<any>,
      thinkingLevel: model?.reasoning ? "medium" : "off",
      tools: allTools,
      messages: [],
    },
    convertToLlm,
    transformContext,
  };

  if (streamFn) {
    agentOptions.streamFn = streamFn;
  }

  const agent = new Agent(agentOptions);

  // Track whether the agent is currently processing a prompt
  let agentBusy = false;
  let previousState: TState | null = null;

  /**
   * Enqueue a prompt for the agent. If the agent is idle, starts a new run.
   * If busy, uses followUp() so it's processed after the current work finishes.
   */
  const enqueuePrompt = (prompt: string): Promise<void> => {
    if (agentBusy) {
      agent.followUp({
        role: "user" as const,
        content: prompt,
        timestamp: Date.now(),
      });
      return Promise.resolve();
    }
    agentBusy = true;
    const p = agent.prompt(prompt);
    p.then(
      () => {
        agentBusy = false;
      },
      () => {
        agentBusy = false;
      },
    );
    return p;
  };

  // Create tick loop — fires on fixed cadence, steers agent with fresh state
  const ticker = createTickLoop({
    intervalMs: tickIntervalMs,
    onTick: async () => {
      // Fetch fresh world state
      const state = await adapter.getWorldState();
      const prompt = customFormatTickPrompt
        ? customFormatTickPrompt(state, previousState)
        : formatTickPrompt(state);
      previousState = state;

      if (agentBusy) {
        // Agent is mid-run — steer with fresh state.
        // Delivered after current tool execution, skips remaining queued tools.
        agent.steer({
          role: "user" as const,
          content: `[WORLD STATE UPDATE]\n\n${prompt}`,
          timestamp: Date.now(),
        });
      } else {
        // Agent is idle — start a new run (don't block the tick loop)
        agentBusy = true;
        agent.prompt(prompt).then(
          () => {
            agentBusy = false;
          },
          (err) => {
            agentBusy = false;
            onTickError?.(err instanceof Error ? err : new Error(String(err)));
          },
        );
      }
    },
    onError:
      onTickError ??
      ((err) => {
        console.error("Tick error:", err.message);
      }),
  });

  return {
    agent,
    tools: allTools,
    ticker,
    recorder,
    enqueuePrompt,
    reloadPrompt() {
      agent.setSystemPrompt(buildSystemPromptFromDataDir(currentDataDir));
    },
    setDataDir(dataDir: string) {
      currentDataDir = dataDir;
      agent.setSystemPrompt(buildSystemPromptFromDataDir(currentDataDir));
      allTools = buildTools();
      agent.setTools(allTools);
    },
    getDataDir() {
      return currentDataDir;
    },
    async dispose() {
      ticker.stop();
      agent.abort();
    },
  };
}
