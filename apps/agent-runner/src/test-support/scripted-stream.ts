import type { StreamFn } from "@mariozechner/pi-agent-core";
import { createAssistantMessageEventStream, type Context } from "@mariozechner/pi-ai";

import { scriptedAssistantMessage } from "../fake-stream";

export interface ScriptedReply {
  text?: string;
  toolCall?: { name: string; args: Record<string, unknown> };
  /** The model call stays in flight until this resolves: the agent is mid-turn for as long as the test wants. */
  hold?: Promise<void>;
}

interface ScriptedStream {
  streamFn: StreamFn;
  /** The context of every model call, in order: what the model was shown. */
  calls: Context[];
}

/** A model whose replies the test writes per call number. */
export const createScriptedStream = (script: (call: number, context: Context) => ScriptedReply): ScriptedStream => {
  const calls: Context[] = [];
  const streamFn: StreamFn = async (model, context, options) => {
    calls.push(context);
    const reply = script(calls.length, context);
    if (reply.hold) await Promise.race([reply.hold, aborted(options?.signal)]);
    const message = reply.toolCall
      ? scriptedAssistantMessage(model, "toolUse", [
          { type: "toolCall", id: `call_${calls.length}`, name: reply.toolCall.name, arguments: reply.toolCall.args },
        ])
      : scriptedAssistantMessage(model, "stop", [{ type: "text", text: reply.text ?? "Nothing to do." }]);
    const stream = createAssistantMessageEventStream();
    stream.push({ type: "start", partial: message });
    stream.push({ type: "done", reason: message.stopReason, message });
    return stream;
  };
  return { streamFn, calls };
};

/** A held call must still end when the agent is aborted, or a stopped loop would wait forever for idle. */
const aborted = (signal: AbortSignal | undefined): Promise<void> =>
  new Promise((resolve) => {
    if (!signal) return;
    if (signal.aborted) resolve();
    signal.addEventListener("abort", () => resolve(), { once: true });
  });

export const deferred = () => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
