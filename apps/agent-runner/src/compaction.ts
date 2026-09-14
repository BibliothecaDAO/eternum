import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";

import { logEvent } from "./log";
import { renderCompactionNotice } from "./prompt";

export interface CompactionSettings {
  /** Transcript size, in characters of message content, above which compaction runs. */
  budgetChars: number;
  /** What compaction prunes down to, so it does not run again on the very next call. */
  targetChars: number;
}

export const DEFAULT_COMPACTION: CompactionSettings = { budgetChars: 120_000, targetChars: 60_000 };

interface Compaction {
  messages: AgentMessage[];
  dropped: number;
}

/**
 * Installs the context transform: above budget, the oldest turns go, the system prompt is rebuilt from the agent's
 * files on disk, and the first surviving message carries a notice of what was dropped.
 */
export const installCompaction = (
  agent: Agent,
  settings: CompactionSettings,
  reloadSystemPrompt: () => Promise<string>,
): void => {
  agent.transformContext = async (messages) => {
    const compaction = compactTranscript(messages, settings);
    if (compaction.dropped === 0) return messages;
    await refreshSystemPrompt(agent, reloadSystemPrompt);
    // pi keeps its own copy of the run's context; trimming the agent's transcript too keeps memory bounded across runs.
    agent.state.messages = compaction.messages;
    logEvent("agent_runner_context_compacted", {
      dropped: compaction.dropped,
      kept: compaction.messages.length,
      chars: transcriptChars(compaction.messages),
    });
    return compaction.messages;
  };
};

/** Drops whole turns from the oldest end until the transcript fits the target; a turn starts at a user message. */
export const compactTranscript = (messages: AgentMessage[], settings: CompactionSettings): Compaction => {
  let remaining = transcriptChars(messages);
  if (remaining <= settings.budgetChars) return { messages, dropped: 0 };
  let start = 0;
  for (const boundary of turnBoundaries(messages)) {
    if (remaining <= settings.targetChars) break;
    remaining -= transcriptChars(messages.slice(start, boundary));
    start = boundary;
  }
  if (start === 0) return { messages, dropped: 0 };
  const [first, ...rest] = messages.slice(start);
  return { messages: [withCompactionNotice(first!, start), ...rest], dropped: start };
};

const turnBoundaries = (messages: AgentMessage[]): number[] =>
  messages.flatMap((message, index) => (index > 0 && message.role === "user" ? [index] : []));

/** The notice rides on the first kept user message rather than as its own, so no provider sees two user turns in a row. */
const withCompactionNotice = (message: AgentMessage, dropped: number): AgentMessage => {
  const notice = renderCompactionNotice(dropped);
  if (message.role !== "user") return message;
  if (typeof message.content === "string") return { ...message, content: `${notice}\n\n${message.content}` };
  return { ...message, content: [{ type: "text", text: notice }, ...message.content] };
};

const refreshSystemPrompt = async (agent: Agent, reloadSystemPrompt: () => Promise<string>): Promise<void> => {
  try {
    agent.state.systemPrompt = await reloadSystemPrompt();
  } catch (error) {
    // The transform must not throw; a stale prompt is better than an aborted turn, and the line says why.
    logEvent("agent_runner_prompt_reload_failed", { error: error instanceof Error ? error.message : String(error) });
  }
};

export const transcriptChars = (messages: AgentMessage[]): number =>
  messages.reduce((total, message) => total + JSON.stringify(message.content).length, 0);
