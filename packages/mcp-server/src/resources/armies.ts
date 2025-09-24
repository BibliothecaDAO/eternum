import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

function parseArmyId(uri: URL, params: Record<string, string | undefined>): number {
  const value = params.entityId ?? uri.pathname.split("/").pop() ?? "";
  const armyId = Number(value);

  if (!Number.isFinite(armyId)) {
    throw new Error(`Invalid army id: ${value}`);
  }

  return armyId;
}

export function registerArmyResource(server: McpServer, context: ServerContext): void {
  const template = new ResourceTemplate("eternum://armies/{entityId}", { list: undefined });

  server.registerResource(
    "armies",
    template,
    {
      title: "Eternum Armies",
      description: "Explorer and army snapshots",
    },
    async (uri, params) => {
      const armyId = parseArmyId(uri, params ?? {});
      const summary = await context.torii.getArmySummary(armyId);

      if (!summary) {
        throw new Error(`Army ${armyId} not found`);
      }

      return jsonResource(uri, {
        army: summary,
      });
    },
  );
}
