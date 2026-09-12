import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AfterToolCallContext, Agent } from "@mariozechner/pi-agent-core";

import type { ActionOutcome, RunManifestRecorder } from "./manifest";
import { clipText } from "./tools/result";

const TAPE_FILE = path.join("debug", "tool-responses.log");
const TAPE_TEXT_LIMIT = 4_000;
const ACT_TOOL = "act";

/** Every tool call and its result, one JSON line each, plus the act outcomes the manifest counts. */
export const installToolTape = (agent: Agent, dataDir: string, manifest: RunManifestRecorder): void => {
  const tapePath = path.join(dataDir, TAPE_FILE);
  agent.afterToolCall = async (call) => {
    await appendTape(tapePath, describeToolCall(call));
    if (call.toolCall.name === ACT_TOOL) manifest.recordAction(actionName(call), actionOutcome(call));
    return undefined;
  };
};

const describeToolCall = (call: AfterToolCallContext) => ({
  at: new Date().toISOString(),
  toolCallId: call.toolCall.id,
  tool: call.toolCall.name,
  args: call.args,
  isError: call.isError,
  text: clipText(
    call.result.content.map((part) => (part.type === "text" ? part.text : `[${part.type}]`)).join("\n"),
    TAPE_TEXT_LIMIT,
  ),
  details: call.result.details as unknown,
});

const appendTape = async (tapePath: string, line: object): Promise<void> => {
  await mkdir(path.dirname(tapePath), { recursive: true });
  await appendFile(tapePath, `${JSON.stringify(line, bigintAsString)}\n`);
};

const actionName = (call: AfterToolCallContext): string => {
  const args = call.args as { action?: unknown };
  return typeof args?.action === "string" ? args.action : "unknown";
};

/** The act tool's details are its outcome; a tool that threw before producing one is a failure of its own class. */
const actionOutcome = (call: AfterToolCallContext): ActionOutcome => {
  const details = call.result.details as { kind?: unknown; error?: { kind?: unknown } } | undefined;
  if (call.isError || !isOutcomeKind(details?.kind)) return { kind: "failed", failureClass: "tool_error" };
  if (details.kind === "failed") {
    return { kind: "failed", failureClass: typeof details.error?.kind === "string" ? details.error.kind : "unknown" };
  }
  return { kind: details.kind };
};

const isOutcomeKind = (value: unknown): value is ActionOutcome["kind"] =>
  value === "planned" || value === "confirmed" || value === "refused" || value === "failed";

const bigintAsString = (_key: string, value: unknown): unknown =>
  typeof value === "bigint" ? value.toString() : value;
