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
import type { GameAgentConfig, RuntimeConfigManager, WorldState } from "./types.js";

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
	} = options;
	let currentDataDir = options.dataDir;

	const buildTools = () => {
		const gameTools = createGameTools(adapter);
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
		return messages.filter(
			(m): m is Message => m.role === "user" || m.role === "assistant" || m.role === "toolResult",
		);
	};

	// Context windowing: estimate tokens and trim old messages to stay under budget.
	// Rough estimate: 1 token ≈ 4 chars for English text / JSON.
	const MAX_CONTEXT_TOKENS = 150_000;
	const CHARS_PER_TOKEN = 4;
	const MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * CHARS_PER_TOKEN;

	function estimateMessageChars(msg: AgentMessage): number {
		if (msg.role !== "user" && msg.role !== "assistant" && msg.role !== "toolResult") return 0;
		if (!msg.content) return 0;
		if (typeof msg.content === "string") return msg.content.length;
		if (Array.isArray(msg.content)) {
			let total = 0;
			for (const block of msg.content) {
				if (block.type === "text") total += block.text.length;
				else if (block.type === "toolCall") total += JSON.stringify(block.arguments ?? {}).length + (block.name?.length ?? 0);
			}
			return total;
		}
		return 0;
	}

	const transformContext = async (messages: AgentMessage[]): Promise<AgentMessage[]> => {
		// Always keep the most recent messages. Walk backwards until we hit the budget.
		let totalChars = 0;
		let cutoff = messages.length;
		for (let i = messages.length - 1; i >= 0; i--) {
			totalChars += estimateMessageChars(messages[i]);
			if (totalChars > MAX_CONTEXT_CHARS) {
				cutoff = i + 1;
				break;
			}
		}
		if (cutoff > 0 && cutoff < messages.length) {
			const trimmed = messages.slice(cutoff);
			// Ensure we start with a user/toolResult message (not assistant)
			while (trimmed.length > 0 && trimmed[0].role === "assistant") {
				trimmed.shift();
			}
			process.stderr.write(`[context] trimmed ${messages.length - trimmed.length} old messages (${messages.length} → ${trimmed.length})\n`);
			return trimmed;
		}
		return messages;
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
