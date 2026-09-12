import {
  ActionPaths,
  ActionType,
  ClientConfigManager,
  createGameActions,
  type GameClient,
} from "@bibliothecadao/eternum";
import { ContractAddress, getNeighborHexes } from "@bibliothecadao/types";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it } from "vitest";

import { createFakeGame, PLAYER, seedExplorer, seedGameRegistry, seedStructure } from "../test-support/fake-game";
import { ACTION_CATALOG, ACTION_NAMES } from "./action-catalog";
import { createActTool, runAction } from "./act";
import { createRunnerTools } from "./index";
import { filterActions } from "./list-actions";
import { createObserveTool, OBSERVE_FOCUSES, OBSERVE_TEXT_LIMIT, renderFocus } from "./observe";

const RIVAL = ContractAddress(0xdefn);

afterEach(() => {
  ClientConfigManager.instance().setActiveGame(0, 0);
});

describe("action catalog", () => {
  it("covers exactly the GameActions keys", () => {
    const clientKeys = Object.keys(createGameActions({ setup: {} } as GameClient)).sort();

    expect([...ACTION_NAMES].sort()).toEqual(clientKeys);
    for (const name of ACTION_NAMES) {
      expect(ACTION_CATALOG[name].description.length).toBeGreaterThan(20);
      expect(ACTION_CATALOG[name].params.type).toBe("object");
    }
  });
});

describe("list_actions", () => {
  it("filters by keyword across name, description, and preconditions", () => {
    expect(filterActions(undefined)).toEqual(ACTION_NAMES);
    expect(filterActions("guard")).toEqual(["structurePaths", "addTroopsToGuard"]);
    expect(filterActions("BUILDING")).toEqual([
      "placeBuilding",
      "destroyBuilding",
      "pauseProduction",
      "resumeProduction",
    ]);
    expect(filterActions("zeppelin")).toEqual([]);
  });
});

describe("observe_game", () => {
  it("renders every focus for a settled player and stays under the size cap", async () => {
    const game = createFakeGame();
    seedGameRegistry(game.components, { status: "Live", startMainAt: 0, endAt: 0 });
    seedStructure(game.components, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
    seedStructure(game.components, { entityId: 13, owner: RIVAL, x: 102, y: 100 });
    const homeHex = getNeighborHexes(100, 100)[0]!;
    seedExplorer(game.components, { explorerId: 101, owner: 12, x: homeHex.col, y: homeHex.row });
    seedExplorer(game.components, { explorerId: 201, owner: 13, x: 101, y: 101 });
    game.events.push({ at: 0, models: ["StoryEvent"], summary: "{}" });
    const tool = createObserveTool(game);

    for (const focus of OBSERVE_FOCUSES) {
      const result = await tool.execute("call", { focus });
      const text = result.content[0]!.type === "text" ? result.content[0]!.text : "";
      expect(text.length, focus).toBeLessThanOrEqual(OBSERVE_TEXT_LIMIT);
      expect(text, focus).toContain('Game 28 "lab-game" | phase live');
    }

    expect(renderFocus(game, "empire")).toContain("#12 Realm L1 at (100,100)");
    expect(renderFocus(game, "empire")).not.toContain("#13");
    expect(renderFocus(game, "armies")).toContain("#101 (home #12): 10 Knight T1, stamina 50");
    expect(renderFocus(game, "armies")).toContain("at home");
    // The projection places structures from TileOpt rows, which this world does not seed; armies come from ExplorerTroops.
    expect(renderFocus(game, "nearby")).toContain("Explorer #101 at (101,100)");
    expect(renderFocus(game, "nearby")).toContain("army #201 Knight T1 at (101,101)");
    expect(renderFocus(game, "events")).toContain("StoryEvent");
  });

  it("tells a spectator it owns nothing", async () => {
    const game = createFakeGame(null);
    const result = await createObserveTool(game).execute("call", {});
    const text = result.content[0]!.type === "text" ? result.content[0]!.text : "";

    expect(text).toContain("spectator (no signer)");
    expect(text).toContain("I own no structures");
  });
});

describe("act", () => {
  it("dispatches a submitting action and reports the confirmation", async () => {
    const game = createFakeGame();
    game.actions.createExplorerArmy.mockImplementation(async () => game.announceSubmitted("0xabc123"));

    const outcome = await runAction(game, {
      action: "createExplorerArmy",
      params: { structureId: 12, troopType: "Knight", troopTier: "T1", troopCount: 10, spawnDirection: 0 },
    });

    expect(game.actions.createExplorerArmy).toHaveBeenCalledWith({
      structureId: 12,
      troopType: "Knight",
      troopTier: "T1",
      troopCount: 10,
      spawnDirection: 0,
    });
    expect(outcome).toEqual({ kind: "confirmed", transactionHash: "0xabc123", block: 7 });
  });

  it("reports a classified failure instead of throwing", async () => {
    const game = createFakeGame();
    game.actions.placeBuilding.mockImplementation(async () => {
      game.announceSubmitted("0xdead");
      throw new Error("Transaction failed with reason: Insufficient Balance");
    });

    const outcome = await runAction(game, {
      action: "placeBuilding",
      params: { structureId: 12, buildingType: 37, hex: { col: 10, row: 10 }, useSimpleCost: true },
    });

    expect(outcome).toMatchObject({ kind: "failed", transactionHash: "0xdead", error: { kind: "reverted" } });
  });

  it("refuses invalid params before touching the client", async () => {
    const game = createFakeGame();

    const outcome = await runAction(game, { action: "deleteExplorerArmy", params: { structureId: "twelve" } });

    expect(outcome).toMatchObject({ kind: "refused" });
    expect((outcome as { reason: string }).reason).toContain("invalid params");
    expect(game.actions.deleteExplorerArmy).not.toHaveBeenCalled();
  });

  it("refuses to submit without a signer and says so", async () => {
    const game = createFakeGame(null);
    const tool = createActTool(game);

    const result = await tool.execute("call", {
      action: "deleteExplorerArmy",
      params: { structureId: 12, explorerId: 101 },
    });

    expect(result.content[0]).toMatchObject({ type: "text", text: expect.stringContaining("no signer") });
    expect(game.actions.deleteExplorerArmy).not.toHaveBeenCalled();
  });

  it("resolves a move's path from armyPaths and refuses an unreachable target", async () => {
    const game = createFakeGame();
    seedStructure(game.components, { entityId: 12, owner: PLAYER, x: 100, y: 100 });
    seedExplorer(game.components, { explorerId: 101, owner: 12, x: 120, y: 120 });
    const reachable = { hex: getNeighborHexes(120, 120)[0]!, actionType: ActionType.Explore };
    game.actions.armyPaths.mockImplementation(() => {
      const paths = new ActionPaths();
      paths.set(ActionPaths.posKey(reachable.hex), [
        { hex: { col: 120, row: 120 }, actionType: reachable.actionType },
        { hex: reachable.hex, actionType: reachable.actionType },
      ]);
      return paths;
    });
    game.actions.moveArmy.mockImplementation(async () => game.announceSubmitted("0xmove"));

    const refused = await runAction(game, {
      action: "moveArmy",
      params: { explorerId: 101, target: { col: 1, row: 1 } },
    });
    const confirmed = await runAction(game, {
      action: "moveArmy",
      params: { explorerId: 101, target: { col: reachable.hex.col, row: reachable.hex.row } },
    });

    expect(refused).toMatchObject({ kind: "refused", reason: expect.stringContaining("(1,1) is not reachable") });
    expect(game.actions.moveArmy).toHaveBeenCalledTimes(1);
    expect(game.actions.moveArmy.mock.calls[0]![0]).toMatchObject({ explorerId: 101, path: expect.any(Array) });
    expect(confirmed).toMatchObject({ kind: "confirmed", transactionHash: "0xmove" });
  });
});

describe("createRunnerTools", () => {
  it("exposes the seven tools with typebox schemas", () => {
    const tools: AgentTool[] = createRunnerTools(createFakeGame(), "/tmp/agent-runner-test");

    expect(tools.map((tool) => tool.name)).toEqual([
      "observe_game",
      "list_actions",
      "act",
      "simulate",
      "remember",
      "recall",
      "report_to_owner",
    ]);
    for (const tool of tools) expect(tool.parameters).toHaveProperty("type");
  });
});
