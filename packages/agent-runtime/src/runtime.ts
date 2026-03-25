import EventEmitter from "eventemitter3";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage as CoreAgentMessage } from "@mariozechner/pi-agent-core";

import type {
  ActionBatchResult,
  AgentTurnResult,
  ManagedAgentRuntime,
  ManagedAgentRuntimeEvent,
  ManagedAgentRuntimeInput,
  RunAgentTurnInput,
  WorldActionBatchInput,
} from "./types";
import { buildSteeringMemoryNote, buildSteeringPromptSupplement } from "./steering";

function defaultConvertToLlm(messages: CoreAgentMessage[]) {
  return messages.filter(
    (message): message is any =>
      message.role === "user" || message.role === "assistant" || message.role === "toolResult",
  );
}

export function createManagedAgentRuntime(input: ManagedAgentRuntimeInput): ManagedAgentRuntime {
  const events = new EventEmitter<{ event: [ManagedAgentRuntimeEvent] }>();
  let busy = false;

  const agent = new Agent({
    initialState: {
      systemPrompt: input.systemPromptBuilder(input.dataDir),
      model: input.model,
      thinkingLevel: input.model.reasoning ? "medium" : "off",
      tools: input.tools,
      messages: [],
    },
    convertToLlm: input.convertToLlm ?? defaultConvertToLlm,
    transformContext: input.transformContext,
    followUpMode: input.followUpMode ?? "one-at-a-time",
  });

  agent.subscribe((event) => {
    events.emit("event", {
      type: event.type,
      payload: event as Record<string, unknown>,
    });
  });

  return {
    dataDir: input.dataDir,
    isBusy() {
      return busy;
    },
    async prompt(prompt: string) {
      busy = true;
      events.emit("event", {
        type: "managed_runtime.prompt_start",
        payload: { prompt },
      });

      try {
        await agent.prompt(prompt);
        events.emit("event", {
          type: "managed_runtime.prompt_end",
          payload: { prompt },
        });
      } finally {
        busy = false;
      }
    },
    followUp(prompt: string) {
      agent.followUp({
        role: "user",
        content: prompt,
        timestamp: Date.now(),
      });
    },
    reloadPrompt() {
      agent.setSystemPrompt(input.systemPromptBuilder(input.dataDir));
      events.emit("event", {
        type: "managed_runtime.prompt_reloaded",
      });
    },
    onEvent(listener) {
      events.on("event", listener);
      return () => {
        events.off("event", listener);
      };
    },
    async dispose() {
      busy = false;
      events.removeAllListeners();
    },
  };
}

export async function runAgentTurn(input: RunAgentTurnInput): Promise<AgentTurnResult> {
  const startedAt = new Date().toISOString();
  let toolCalls = 0;
  const effectivePrompt = buildTurnPrompt(input.prompt, input.steeringOverlay);

  const unsubscribe = input.runtime.onEvent((event) => {
    if (event.type === "tool_execution_start") {
      toolCalls += 1;
    }
  });

  try {
    if (input.runtime.isBusy()) {
      input.runtime.followUp(effectivePrompt);
      return {
        startedAt,
        finishedAt: new Date().toISOString(),
        wakeReason: input.wakeReason,
        toolCalls: 0,
        success: true,
      };
    }

    await input.runtime.prompt(effectivePrompt);

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      wakeReason: input.wakeReason,
      toolCalls,
      success: true,
    };
  } catch (error) {
    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      wakeReason: input.wakeReason,
      toolCalls,
      success: false,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  } finally {
    unsubscribe();
  }
}

function buildTurnPrompt(prompt: string, steeringOverlay: RunAgentTurnInput["steeringOverlay"]): string {
  const sections = [buildSteeringPromptSupplement(steeringOverlay)];
  const memoryNote = buildSteeringMemoryNote(steeringOverlay);
  if (memoryNote) {
    sections.push(`## Steering Memory\n${memoryNote}`);
  }
  sections.push(prompt);
  return sections.filter(Boolean).join("\n\n");
}

export async function runWorldActionBatch<TAction, TResult>(
  input: WorldActionBatchInput<TAction, TResult>,
): Promise<ActionBatchResult<TResult>> {
  const results: ActionBatchResult<TResult>["results"] = [];
  let succeeded = 0;

  for (const [index, action] of input.actions.entries()) {
    try {
      const result = await input.execute(action, index);
      succeeded += 1;
      results.push({ ok: true, result });
    } catch (error) {
      results.push({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    total: input.actions.length,
    succeeded,
    failed: input.actions.length - succeeded,
    results,
  };
}

export async function disposeManagedAgentRuntime(input: { runtime: ManagedAgentRuntime }): Promise<void> {
  await input.runtime.dispose();
}
