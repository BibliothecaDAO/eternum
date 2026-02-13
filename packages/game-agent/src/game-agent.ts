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
  } = options;
  let currentDataDir = options.dataDir;

  const buildTools = () => {
    const gameTools = createGameTools(adapter, actionDefs);
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
  };

  if (streamFn) {
    agentOptions.streamFn = streamFn;
  }

  const agent = new Agent(agentOptions);
  let promptQueue = Promise.resolve();

  const enqueuePrompt = (prompt: string): Promise<void> => {
    const run = async () => {
      await agent.prompt(prompt);
    };
    // Keep the queue alive after failures so later prompts can still run.
    promptQueue = promptQueue.then(run, run);
    return promptQueue;
  };

  // Create tick loop
  const ticker = createTickLoop({
    intervalMs: tickIntervalMs,
    onTick: async () => {
      const nextPrompt = buildSystemPromptFromDataDir(currentDataDir);
      if (nextPrompt !== agent.state.systemPrompt) {
        agent.setSystemPrompt(nextPrompt);
      }
      const state = await adapter.getWorldState();
      const prompt = formatTickPrompt(state);
      await enqueuePrompt(prompt);
    },
    onError: (err) => {
      console.error("Tick error:", err.message);
    },
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
