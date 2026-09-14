import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ClientConfigManager } from "@bibliothecadao/eternum";
import { getNeighborHexes } from "@bibliothecadao/types";
import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { getModel, type Context } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_COMPACTION } from "./compaction";
import { createScriptedDirectionSource } from "./directions";
import { runAgentLoop } from "./loop";
import { createRunManifest } from "./manifest";
import { GAME_ENDED_PREFIX, OWNER_DIRECTION_PREFIX, WORLD_STATE_UPDATE_PREFIX } from "./prompt";
import { createFakeGame, PLAYER, seedExplorer, seedGameRegistry, seedStructure } from "./test-support/fake-game";
import { createScriptedStream, deferred, type ScriptedReply } from "./test-support/scripted-stream";
import { createTestClock } from "./test-support/test-clock";
import { createRunnerTools } from "./tools";

const HOME = { x: 100, y: 100 };
const QUIET_WINDOW_MS = 100;
const HEARTBEAT_MS = 1_000;

const answer: ScriptedReply = { text: "Holding position." };
const dataDirs: string[] = [];
const running: LoopHarness[] = [];

afterEach(async () => {
  for (const loop of running.splice(0)) {
    loop.stop();
    await loop.done.catch(() => undefined);
  }
  vi.restoreAllMocks();
  ClientConfigManager.instance().setActiveGame(0, 0);
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

interface TickLine {
  tick: number;
  reason: string;
  actionable: boolean;
  delivery: string;
}

interface LoopHarness {
  game: ReturnType<typeof createFakeGame>;
  agent: Agent;
  calls: Context[];
  manifest: ReturnType<typeof createRunManifest>;
  clock: ReturnType<typeof createTestClock>;
  dataDir: string;
  stop(): void;
  done: Promise<string>;
  tickLines(): TickLine[];
  /** Ticks end in a manifest write, so a test waits for the line rather than counting microtasks. */
  untilTicks(count: number): Promise<void>;
}

const startLoop = async (input: {
  script?: (call: number, context: Context) => ScriptedReply;
  directions?: string[];
  maxTicks?: number;
}): Promise<LoopHarness> => {
  const game = createFakeGame();
  seedGameRegistry(game.components, { status: "Live", startMainAt: 0, endAt: 0 });
  seedStructure(game.components, { entityId: 12, owner: PLAYER, x: HOME.x, y: HOME.y });
  const spawn = getNeighborHexes(HOME.x, HOME.y)[0]!;
  seedExplorer(game.components, { explorerId: 101, owner: 12, x: spawn.col, y: spawn.row });

  const dataDir = await mkdtemp(path.join(tmpdir(), "agent-loop-"));
  dataDirs.push(dataDir);
  const stream = createScriptedStream(input.script ?? (() => answer));
  const agent = new Agent({
    initialState: {
      systemPrompt: "soul v1",
      model: getModel("openrouter", "openai/gpt-4o-mini"),
      tools: createRunnerTools(game, dataDir),
    },
    streamFn: stream.streamFn,
  });
  const manifest = createRunManifest({
    dataDir,
    chain: { chain: "madara", rpcUrl: "https://rpc.example", heraldUrl: "https://herald.example" },
    game: { gameId: 28, gameName: "lab-game", mode: "blitz", viewer: "0xabc" },
    model: { profile: "balanced", id: "openai/gpt-4o-mini" },
  });
  const clock = createTestClock();
  const controller = new AbortController();
  const lines: string[] = [];
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    lines.push(line);
  });
  const tickLines = (): TickLine[] =>
    lines.flatMap((line) => {
      const entry = JSON.parse(line) as { event: string } & TickLine;
      return entry.event === "agent_runner_tick" ? [entry] : [];
    });

  const done = runAgentLoop({
    game,
    agent,
    manifest,
    systemPrompt: { current: async () => "soul v1" },
    directions: createScriptedDirectionSource(input.directions ?? []),
    settings: {
      quietWindowMs: QUIET_WINDOW_MS,
      heartbeatMs: HEARTBEAT_MS,
      maxTicks: input.maxTicks ?? null,
      compaction: DEFAULT_COMPACTION,
    },
    dataDir,
    clock,
    signal: controller.signal,
  });
  const harness: LoopHarness = {
    game,
    agent,
    calls: stream.calls,
    manifest,
    clock,
    dataDir,
    stop: () => controller.abort(),
    done,
    tickLines,
    untilTicks: (count) => vi.waitFor(() => expect(tickLines().length).toBeGreaterThanOrEqual(count)),
  };
  running.push(harness);
  await harness.untilTicks(1);
  return harness;
};

const textOf = (message: AgentMessage | undefined): string => {
  if (!message || message.role !== "user") return "";
  return typeof message.content === "string"
    ? message.content
    : message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
};

const userMessages = (agent: Agent): string[] =>
  agent.state.messages.filter((message) => message.role === "user").map(textOf);

describe("runAgentLoop", () => {
  it("prompts once at startup and skips a world delta in which nothing of mine changed", async () => {
    const loop = await startLoop({});
    await loop.agent.waitForIdle();
    expect(loop.calls).toHaveLength(1);

    loop.game.applySlice();
    await loop.clock.advance(QUIET_WINDOW_MS);
    await loop.untilTicks(2);

    expect(loop.calls).toHaveLength(1);
    expect(loop.tickLines()).toMatchObject([
      { tick: 1, reason: "startup", actionable: true, delivery: "prompted" },
      { tick: 2, reason: "world-delta", actionable: false, delivery: "skipped" },
    ]);

    loop.stop();
    await expect(loop.done).resolves.toBe("interrupted");
  });

  it("folds a burst of slices into one wake at the end of the window that the first slice opened", async () => {
    const loop = await startLoop({});
    await loop.agent.waitForIdle();

    loop.game.applySlice();
    await loop.clock.advance(QUIET_WINDOW_MS / 2);
    loop.game.applySlice();
    expect(loop.tickLines()).toHaveLength(1);

    await loop.clock.advance(QUIET_WINDOW_MS / 2);
    await loop.untilTicks(2);
    await loop.clock.advance(QUIET_WINDOW_MS * 2);
    expect(loop.tickLines()).toHaveLength(2);
  });

  it("steers a busy agent with a hostile in reach, follows up a direction, and coalesces repeat steers", async () => {
    const gate = deferred();
    const loop = await startLoop({
      script: (call) => (call === 1 ? { text: "Thinking…", hold: gate.promise } : answer),
      directions: ["Hold the line near home."],
    });
    const steer = vi.spyOn(loop.agent, "steer");
    await loop.untilTicks(2);
    expect(loop.agent.state.isStreaming).toBe(true);
    expect(loop.tickLines()).toMatchObject([
      { reason: "startup", delivery: "prompted" },
      { reason: "direction", actionable: true, delivery: "followed-up" },
    ]);

    seedExplorer(loop.game.components, { explorerId: 201, owner: 13, x: HOME.x + 2, y: HOME.y + 1 });
    loop.game.applySlice();
    await loop.clock.advance(QUIET_WINDOW_MS);
    await loop.untilTicks(3);
    expect(steer).toHaveBeenCalledTimes(1);
    expect(loop.tickLines().at(-1)).toMatchObject({ reason: "world-delta", actionable: true, delivery: "steered" });

    seedExplorer(loop.game.components, { explorerId: 201, owner: 13, x: HOME.x + 1, y: HOME.y + 1 });
    loop.game.applySlice();
    await loop.clock.advance(QUIET_WINDOW_MS);
    await loop.untilTicks(4);
    expect(steer).toHaveBeenCalledTimes(1);
    expect(loop.tickLines().at(-1)).toMatchObject({ reason: "world-delta", actionable: true, delivery: "coalesced" });

    gate.resolve();
    // The delta coalesced behind the steer becomes its own wake once the steer is consumed.
    await loop.untilTicks(5);
    await loop.agent.waitForIdle();

    expect(loop.tickLines().at(-1)).toMatchObject({ tick: 5, reason: "world-delta", actionable: true });
    const seen = userMessages(loop.agent);
    const worldUpdate = seen.findIndex((text) => text.startsWith(WORLD_STATE_UPDATE_PREFIX));
    const direction = seen.findIndex((text) => text.startsWith(OWNER_DIRECTION_PREFIX));
    expect(worldUpdate).toBeGreaterThan(0);
    expect(direction).toBeGreaterThan(worldUpdate);
    expect(seen[worldUpdate]).toContain("Hostile armies now within reach: #201");
    expect(seen.some((text) => text.includes("Hostile armies moved: #201"))).toBe(true);
  });

  it("always calls the model on a heartbeat, even with no delta", async () => {
    const loop = await startLoop({});
    await loop.agent.waitForIdle();

    await loop.clock.advance(HEARTBEAT_MS);
    await loop.untilTicks(2);

    expect(loop.calls).toHaveLength(2);
    expect(loop.tickLines().at(-1)).toMatchObject({ reason: "heartbeat", actionable: true, delivery: "prompted" });
    expect(textOf(loop.calls[1]!.messages.at(-1))).toContain("[HEARTBEAT]");
  });

  it("asks for a final report and stops when the phase flips to ended", async () => {
    const loop = await startLoop({});
    await loop.agent.waitForIdle();

    seedGameRegistry(loop.game.components, { status: "Ended", startMainAt: 0, endAt: 0 });
    loop.game.applySlice();
    await loop.clock.advance(QUIET_WINDOW_MS);

    await expect(loop.done).resolves.toBe("game-ended");
    expect(loop.tickLines().at(-1)).toMatchObject({ reason: "phase-change", actionable: true, delivery: "prompted" });
    expect(userMessages(loop.agent).at(-1)).toContain(GAME_ENDED_PREFIX);
    expect(loop.manifest.snapshot()).toMatchObject({ status: "stopped", stopReason: "game-ended" });
  });

  it("stops after --max-ticks and finalises the manifest atomically", async () => {
    const loop = await startLoop({ maxTicks: 1 });

    await expect(loop.done).resolves.toBe("max-ticks");

    const snapshot = loop.manifest.snapshot();
    expect(snapshot).toMatchObject({
      status: "stopped",
      stopReason: "max-ticks",
      loop: { ticks: 1, byReason: { startup: { woken: 1, actionable: 1 } }, deliveries: { prompted: 1 } },
      llm: { calls: 1, tokens: { input: 100, output: 20 }, costUsd: 0.003 },
    });
    const runsDir = path.join(loop.dataDir, "runs");
    const files = await readdir(runsDir);
    expect(files).toEqual([`${snapshot.runId}.json`]);
    expect(JSON.parse(await readFile(path.join(runsDir, files[0]!), "utf8"))).toMatchObject({
      stopReason: "max-ticks",
    });
  });

  it("stops when the sync stream fails", async () => {
    const loop = await startLoop({});

    loop.game.failSync(new Error("live apply failed"));

    await expect(loop.done).resolves.toBe("sync-failed");
  });

  it("writes every tool call to the debug tape and counts act outcomes in the manifest", async () => {
    const loop = await startLoop({
      script: (call) => (call === 1 ? { toolCall: { name: "act", args: { action: "moveArmy", params: {} } } } : answer),
    });
    await loop.agent.waitForIdle();

    const tape = (await readFile(path.join(loop.dataDir, "debug", "tool-responses.log"), "utf8")).trim().split("\n");
    expect(tape).toHaveLength(1);
    expect(JSON.parse(tape[0]!)).toMatchObject({
      tool: "act",
      args: { action: "moveArmy" },
      details: { kind: "refused" },
    });
    expect(loop.manifest.snapshot().actions).toMatchObject({
      refused: 1,
      attempted: 0,
      byKind: { moveArmy: { refused: 1 } },
    });
  });
});
