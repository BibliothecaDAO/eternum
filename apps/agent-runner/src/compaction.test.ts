import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compactTranscript, installCompaction, transcriptChars } from "./compaction";
import { renderCompactionNotice } from "./prompt";
import { createSystemPromptSource } from "./soul";
import { createScriptedStream } from "./test-support/scripted-stream";

const dataDirs: string[] = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

const user = (text: string): AgentMessage => ({ role: "user", content: text, timestamp: 1 });
const assistant = (text: string): AgentMessage => ({
  role: "assistant",
  content: [{ type: "text", text }],
  api: "openai-completions",
  provider: "openrouter",
  model: "m",
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
  stopReason: "stop",
  timestamp: 2,
});

describe("compactTranscript", () => {
  it("leaves a transcript under budget alone", () => {
    const messages = [user("a"), assistant("b"), user("c")];

    expect(compactTranscript(messages, { budgetChars: 1_000, targetChars: 500 })).toEqual({ messages, dropped: 0 });
  });

  it("drops whole turns from the oldest end down to the target and marks the first kept message", () => {
    const turn = (index: number) => [
      user(`question ${index} ${"x".repeat(80)}`),
      assistant(`answer ${index} ${"y".repeat(80)}`),
    ];
    const messages = [...turn(1), ...turn(2), ...turn(3), ...turn(4)];
    const before = transcriptChars(messages);

    const { messages: kept, dropped } = compactTranscript(messages, {
      budgetChars: before - 1,
      targetChars: before / 2,
    });

    // Dropping one turn would leave three (over target); dropping two leaves two (under it), so it stops there.
    expect(dropped).toBe(4);
    expect(kept).toHaveLength(4);
    expect(kept[0]).toMatchObject({ role: "user", content: expect.stringContaining(renderCompactionNotice(4)) });
    expect(kept[0]).toMatchObject({ content: expect.stringContaining("question 3") });
    expect(JSON.stringify(kept)).not.toContain("question 2");
  });

  it("never drops the last turn", () => {
    const messages = [user("x".repeat(500)), assistant("y".repeat(500))];

    expect(compactTranscript(messages, { budgetChars: 10, targetChars: 5 }).dropped).toBe(0);
  });
});

describe("installCompaction", () => {
  it("prunes the agent's transcript and reloads the soul from disk between turns", async () => {
    const dataDir = await mkdtemp(path.join(tmpdir(), "agent-soul-"));
    dataDirs.push(dataDir);
    const stream = createScriptedStream(() => ({ text: "ok" }));
    const agent = new Agent({
      initialState: { systemPrompt: "placeholder", model: getModel("openrouter", "openai/gpt-4o-mini"), tools: [] },
      streamFn: stream.streamFn,
    });
    const source = createSystemPromptSource({ dataDir, gameSummary: "Game 1", toolGuide: [] });
    agent.state.systemPrompt = await source.current();
    installCompaction(agent, { budgetChars: 400, targetChars: 200 }, () => source.current());
    vi.spyOn(console, "log").mockImplementation(() => {});

    await agent.prompt(`first ${"a".repeat(300)}`);
    expect(agent.state.messages).toHaveLength(2);
    expect(agent.state.systemPrompt).toContain("I am a hired commander");

    await writeFile(path.join(dataDir, "soul.md"), "# Soul\n\nI am a cautious builder who never raids.\n");
    await agent.prompt(`second ${"b".repeat(100)}`);

    expect(stream.calls[1]!.messages).toHaveLength(1);
    const shown = stream.calls[1]!.messages[0]!;
    // pi stores a prompted string as text blocks, so the notice lands as the first block of the kept message.
    expect(shown.role === "user" && JSON.stringify(shown.content)).toContain(renderCompactionNotice(2));
    expect(shown.role === "user" && JSON.stringify(shown.content)).toContain("second bbb");
    expect(agent.state.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(agent.state.systemPrompt).toContain("I am a cautious builder who never raids.");
    expect(agent.state.systemPrompt).not.toContain("I am a hired commander");
  });
});
