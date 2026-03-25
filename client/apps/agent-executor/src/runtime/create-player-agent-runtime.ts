import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentMessage, AgentTool } from "@mariozechner/pi-agent-core";
import type { Message, Model } from "@mariozechner/pi-ai";
import { completeSimple, getModel } from "@mariozechner/pi-ai";
import { createReadOnlyTools } from "@mariozechner/pi-coding-agent";
import { createManagedAgentRuntime, disposeManagedAgentRuntime } from "@bibliothecadao/agent-runtime";
import { materializeCartridgeSessionFiles } from "@bibliothecadao/agent-runtime";
import type { ManagedAgentRuntime, StoredCartridgeSessionMaterial } from "@bibliothecadao/agent-runtime";
import type { CartridgeStoredResolvedSession } from "../sessions/cartridge-stored-session-resolver";
import { bootstrap } from "@bibliothecadao/onchain-agent/entry/bootstrap-runtime";
import { createCoreTools } from "@bibliothecadao/onchain-agent/tools/pi-tools";
import { buildSystemPrompt } from "@bibliothecadao/onchain-agent/entry/soul";
import { createX402Model } from "@bibliothecadao/onchain-agent/providers/x402/index";
import { attachRuntimeTransactionObserver } from "./runtime-transaction-events";

type ToolError = {
  tool: string;
  error: string;
};

export async function createPlayerAgentRuntime(input: {
  agentId: string;
  dataDir: string;
  session: CartridgeStoredResolvedSession;
  modelProvider: string;
  modelId: string;
  tickIntervalMs?: number;
}): Promise<{
  runtime: ManagedAgentRuntime;
  buildHeartbeatPrompt(): string;
  dispose(): Promise<void>;
}> {
  if (!input.session.worldAuth || !input.session.material) {
    throw new Error("World auth context and stored cartridge material are required.");
  }

  await materializeCartridgeSessionFiles({
    basePath: join(input.dataDir, ".cartridge"),
    material: input.session.material as StoredCartridgeSessionMaterial,
  });

  const { config, mapCtx, mapLoop, automationLoop, provider, toolCtx } = await bootstrap({
    dataDirOverride: input.dataDir,
    configOverride: {
      chain: input.session.worldAuth.chain,
      chainId: input.session.worldAuth.chainId,
      rpcUrl: input.session.worldAuth.rpcUrl,
      toriiUrl: `${input.session.worldAuth.toriiBaseUrl}`,
      worldAddress: input.session.worldAuth.worldAddress,
      modelProvider: input.modelProvider,
      modelId: input.modelId,
      tickIntervalMs: input.tickIntervalMs,
    },
    manifestOverride: input.session.worldAuth.manifest,
    startMapLoop: true,
    waitForMap: true,
  });

  const model =
    config.modelProvider === "x402"
      ? await createX402Model()
      : ((getModel as Function)(config.modelProvider, config.modelId) as Model<any>);

  const toolErrors: ToolError[] = [];
  const tools: AgentTool[] = [
    ...createReadOnlyTools(config.dataDir),
    ...createCoreTools(toolCtx, mapCtx, config.dataDir),
  ];

  const runtime = createManagedAgentRuntime({
    dataDir: config.dataDir,
    model,
    tools,
    systemPromptBuilder: buildSystemPrompt,
    convertToLlm: (messages: AgentMessage[]): Message[] =>
      messages.filter((message): message is Message => {
        return message.role === "user" || message.role === "assistant" || message.role === "toolResult";
      }),
    followUpMode: "one-at-a-time",
    transformContext: async (messages) => {
      if (mapCtx.snapshot) {
        toolCtx.snapshot = mapCtx.snapshot;
      }
      return pruneMessages(messages, model);
    },
  });

  runtime.onEvent((event) => {
    if (event.type !== "tool_execution_end" || !event.payload?.isError) {
      return;
    }

    const toolName = String(event.payload.toolName ?? "unknown");
    const errorText =
      (event.payload.result as any)?.content
        ?.filter((block: any) => block.type === "text")
        ?.map((block: any) => block.text)
        ?.join("")
        ?.slice(0, 160) ?? "unknown error";
    toolErrors.push({ tool: toolName, error: errorText });
    while (toolErrors.length > 20) {
      toolErrors.shift();
    }
  });

  const detachTransactionObserver = attachRuntimeTransactionObserver({
    provider,
    runtime,
  });

  return {
    runtime,
    buildHeartbeatPrompt() {
      return buildTickPrompt(
        (mapCtx.protocol?.briefing() as Record<string, unknown> | null | undefined) ?? null,
        toolErrors,
        readMemory(config.dataDir),
      );
    },
    async dispose() {
      detachTransactionObserver();
      mapLoop.stop();
      automationLoop.stop();
      await disposeManagedAgentRuntime({ runtime });
    },
  };
}

function readMemory(dataDir: string): string {
  const memoryPath = join(dataDir, "memory.md");
  if (!existsSync(memoryPath)) {
    return "";
  }
  return readFileSync(memoryPath, "utf8").trim();
}

async function pruneMessages(messages: AgentMessage[], model: Model<any>): Promise<AgentMessage[]> {
  const maxChars = (model.contextWindow ?? 200_000) * 3;
  const pruneTarget = Math.floor(maxChars * 0.5);
  if (estimateChars(messages) <= maxChars) {
    return messages;
  }

  const { dropped, kept } = splitMessages(messages, pruneTarget);
  if (dropped.length === 0) {
    return kept;
  }

  let summary = `[Context compacted: ${dropped.length} older messages dropped.]`;
  try {
    const droppedLlm = dropped.filter(
      (message): message is Message =>
        message.role === "user" || message.role === "assistant" || message.role === "toolResult",
    );
    const result = await completeSimple(model, {
      systemPrompt:
        "Summarize this conversation history in 2-3 paragraphs. Focus on strategic decisions, current positions, resource state, plans, and threats.",
      messages: [
        {
          role: "user",
          content: droppedLlm
            .map((message) => {
              const text =
                typeof message.content === "string"
                  ? message.content
                  : Array.isArray(message.content)
                    ? message.content
                        .filter((block: any): block is { type: "text"; text: string } => "text" in block)
                        .map((block: { type: "text"; text: string }) => block.text)
                        .join("\n")
                    : "";
              return `[${message.role}]: ${text}`;
            })
            .join("\n\n"),
          timestamp: Date.now(),
        },
      ],
    });
    const textBlock = result.content.find(
      (block: any): block is { type: "text"; text: string } => block.type === "text",
    );
    if (textBlock) {
      summary = `[Context compacted: ${dropped.length} older messages summarized]\n\n${textBlock.text}`;
    }
  } catch {
    summary += " Use inspect and the map to re-orient.";
  }

  kept.unshift({
    role: "user",
    content: summary,
    timestamp: Date.now(),
  } as AgentMessage);

  return kept;
}

function estimateChars(messages: AgentMessage[]): number {
  let total = 0;
  for (const message of messages) {
    if (typeof (message as Message).content === "string") {
      total += ((message as Message).content as string).length;
      continue;
    }

    if (Array.isArray((message as Message).content)) {
      for (const block of (message as Message).content as Array<any>) {
        if ("text" in block) {
          total += block.text.length;
        }
      }
    }
  }
  return total;
}

function splitMessages(messages: AgentMessage[], target: number): { dropped: AgentMessage[]; kept: AgentMessage[] } {
  let keptChars = 0;
  let cutIndex = messages.length;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as Message;
    let chars = 0;
    if (typeof message.content === "string") {
      chars = message.content.length;
    } else if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if ("text" in block) {
          chars += block.text.length;
        }
      }
    }
    keptChars += chars;
    if (keptChars > target) {
      cutIndex = index + 1;
      break;
    }
  }

  if (cutIndex >= messages.length) {
    cutIndex = messages.length - 1;
  }

  return {
    dropped: messages.slice(0, cutIndex),
    kept: messages.slice(cutIndex),
  };
}

function buildTickPrompt(briefing: Record<string, unknown> | null, toolErrors: ToolError[], memory: string): string {
  if (!briefing) {
    return "Map not yet loaded. Wait for next tick.";
  }

  const parts = ["## Tick", "", JSON.stringify(briefing, null, 2)];
  if (memory) {
    parts.push("", "## Memory", memory);
  }
  if (toolErrors.length > 0) {
    parts.push("", "## Recent Errors", ...toolErrors.map((error) => `- ${error.tool}: ${error.error}`));
  }
  parts.push(
    "",
    "## Constraints",
    "- Stamina regenerates over time (20/tick). Travel costs vary by biome.",
    "- Attacking with low stamina deals no damage.",
    "- Many actions require adjacency.",
    "- Move adjacent before combat, raids, transfers, or chest interaction.",
    "- Simulate before committing when combat is uncertain.",
    "",
    "Act on threats first, then opportunities. If there is a beneficial legal move available now, take it.",
  );
  return parts.join("\n");
}
