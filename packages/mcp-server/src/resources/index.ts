import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";

import { registerArmyResource } from "./armies.js";
import { registerBattleLogResource } from "./battles.js";
import { registerMarketResource } from "./market.js";
import { registerPlayerResource } from "./players.js";
import { registerRealmResource } from "./realms.js";
import { registerTileResource } from "./tiles.js";

export function registerResources(server: McpServer, context: ServerContext): void {
  registerRealmResource(server, context);
  registerArmyResource(server, context);
  registerTileResource(server, context);
  registerMarketResource(server, context);
  registerPlayerResource(server, context);
  registerBattleLogResource(server, context);
}
