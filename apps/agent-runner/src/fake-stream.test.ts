import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ActionPaths, ActionType, ClientConfigManager } from "@bibliothecadao/eternum";
import { ContractAddress, getNeighborHexes } from "@bibliothecadao/types";
import { Agent, type AgentMessage } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { afterEach, describe, expect, it } from "vitest";

import { createOfflineStreamFn, resolveOfflineScout, type OfflineScout } from "./fake-stream";
import { createRunManifest } from "./manifest";
import { createFakeGame, PLAYER, seedExplorer, seedGameRegistry, seedStructure } from "./test-support/fake-game";
import { installToolTape } from "./tool-tape";
import { createRunnerTools } from "./tools";

const RIVAL = ContractAddress(0xdefn);
const SCOUT_HEX = { x: 120, y: 120 };
const REACHABLE = getNeighborHexes(SCOUT_HEX.x, SCOUT_HEX.y)[0]!;
const NO_EMPIRE = { structures: [], explorers: [] };

const dataDirs: string[] = [];

afterEach(async () => {
  ClientConfigManager.instance().setActiveGame(0, 0);
  await Promise.all(dataDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

type FakeGame = ReturnType<typeof createFakeGame>;

/** A world with one explorer that can explore one hex; the planner and the move are stubbed like the tools tests. */
const seedScoutingWorld = (game: FakeGame, owner: ContractAddress): void => {
  seedGameRegistry(game.components, { status: "Live", startMainAt: 0, endAt: 0 });
  seedStructure(game.components, { entityId: 12, owner, x: 100, y: 100 });
  seedExplorer(game.components, { explorerId: 101, owner: 12, x: SCOUT_HEX.x, y: SCOUT_HEX.y });
  game.actions.armyPaths.mockImplementation(() => {
    const paths = new ActionPaths();
    paths.set(ActionPaths.posKey(REACHABLE), [
      { hex: { col: SCOUT_HEX.x, row: SCOUT_HEX.y }, actionType: ActionType.Explore },
      { hex: REACHABLE, actionType: ActionType.Explore, staminaCost: 30 },
    ]);
    return paths;
  });
  game.actions.moveArmy.mockImplementation(async () => game.announceSubmitted("0xmove"));
};

const playOneWake = async (game: FakeGame, scout: OfflineScout | null) => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "agent-fake-stream-"));
  dataDirs.push(dataDir);
  const agent = new Agent({
    initialState: {
      systemPrompt: "soul v1",
      model: getModel("openrouter", "openai/gpt-4o-mini"),
      tools: createRunnerTools(game, dataDir),
    },
    streamFn: createOfflineStreamFn(scout),
  });
  const manifest = createRunManifest({
    dataDir,
    chain: { chain: "madara", rpcUrl: "https://rpc.example", heraldUrl: "https://herald.example" },
    game: { gameId: 28, gameName: "lab-game", mode: "blitz", viewer: "0xabc" },
    model: { profile: "balanced", id: "openai/gpt-4o-mini" },
  });
  installToolTape(agent, dataDir, manifest);
  await agent.prompt("[GAME START] I have just connected to the game.");
  return { messages: agent.state.messages, manifest };
};

const toolCalls = (messages: AgentMessage[]) =>
  messages.flatMap((message) =>
    message.role === "assistant"
      ? message.content.flatMap((part) => (part.type === "toolCall" ? [{ name: part.name, args: part.arguments }] : []))
      : [],
  );

const toolResultTexts = (messages: AgentMessage[]): string[] =>
  messages.flatMap((message) =>
    message.role === "toolResult"
      ? [message.content.map((part) => (part.type === "text" ? part.text : "")).join("")]
      : [],
  );

const scoutingScript = [
  { name: "observe_game", args: {} },
  { name: "list_actions", args: {} },
  { name: "act", args: { action: "armyPaths", params: { explorerId: 101 } } },
  {
    name: "act",
    args: { action: "moveArmy", params: { explorerId: 101, target: { col: REACHABLE.col, row: REACHABLE.row } } },
  },
];

describe("createOfflineStreamFn", () => {
  it("observes, learns the actions, plans, moves once to the first reachable hex, then answers", async () => {
    const game = createFakeGame();
    seedScoutingWorld(game, PLAYER);

    const { messages, manifest } = await playOneWake(game, { explorerId: 101 });

    expect(toolCalls(messages)).toEqual(scoutingScript);
    expect(game.actions.moveArmy).toHaveBeenCalledTimes(1);
    expect(messages.at(-1)).toMatchObject({ role: "assistant", stopReason: "stop" });
    expect(manifest.snapshot().actions).toMatchObject({
      planned: 1,
      confirmed: 1,
      attempted: 1,
      refused: 0,
      byKind: { armyPaths: { planned: 1 }, moveArmy: { confirmed: 1 } },
    });
  });

  it("runs the same script while spectating: the move is refused for want of a signer and counted as refused", async () => {
    const game = createFakeGame(null);
    seedScoutingWorld(game, RIVAL);

    const { messages, manifest } = await playOneWake(game, { explorerId: 101 });

    expect(toolCalls(messages)).toEqual(scoutingScript);
    expect(toolResultTexts(messages).at(-1)).toContain("no signer");
    expect(game.actions.moveArmy).not.toHaveBeenCalled();
    expect(manifest.snapshot().actions).toMatchObject({
      planned: 1,
      refused: 1,
      attempted: 0,
      byKind: { armyPaths: { planned: 1 }, moveArmy: { refused: 1 } },
    });
  });

  it("only observes and answers when there is nothing to scout with", async () => {
    const { messages, manifest } = await playOneWake(createFakeGame(), null);

    expect(toolCalls(messages)).toEqual([{ name: "observe_game", args: {} }]);
    expect(messages.map((message) => message.role)).toEqual(["user", "assistant", "toolResult", "assistant"]);
    expect(manifest.snapshot().actions).toMatchObject({ planned: 0, refused: 0, attempted: 0 });
  });
});

describe("resolveOfflineScout", () => {
  it("prefers my explorer, then the lowest-numbered explorer on the map, and gives up on an empty map", () => {
    const game = createFakeGame(null);
    expect(resolveOfflineScout(game, NO_EMPIRE)).toBeNull();

    seedStructure(game.components, { entityId: 13, owner: RIVAL, x: 102, y: 100 });
    seedExplorer(game.components, { explorerId: 201, owner: 13, x: 101, y: 101 });
    seedExplorer(game.components, { explorerId: 150, owner: 13, x: 103, y: 101 });
    expect(resolveOfflineScout(game, NO_EMPIRE)).toEqual({ explorerId: 150 });
    expect(resolveOfflineScout(game, { structures: [12], explorers: [101] })).toEqual({ explorerId: 101 });
  });
});
