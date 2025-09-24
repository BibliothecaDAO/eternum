import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";

import { registerCombatTools } from "./combat.js";
import { registerMovementTools } from "./movement.js";
import { registerStructureTools } from "./structures.js";
import { registerTradingTools } from "./trading.js";

export function registerTools(server: McpServer, context: ServerContext): void {
  registerTradingTools(server, context);
  registerMovementTools(server, context);
  registerStructureTools(server, context);
  registerCombatTools(server, context);
}
