import type { AgentTool } from "@mariozechner/pi-agent-core";

import type { RunnerGame } from "../game";
import { createActTool } from "./act";
import { createListActionsTool } from "./list-actions";
import { createMemoryTools } from "./memory";
import { createObserveTool } from "./observe";
import { createReportTool } from "./report";
import { createSimulateTool } from "./simulate";

/** The agent's whole surface over the game: thin wrappers over one client, plus its files under the data dir. */
export const createRunnerTools = (game: RunnerGame, dataDir: string): AgentTool[] => [
  createObserveTool(game),
  createListActionsTool(),
  createActTool(game),
  createSimulateTool(game),
  ...createMemoryTools(dataDir),
  createReportTool(dataDir, game.client.gameId),
];
