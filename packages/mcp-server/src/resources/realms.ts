import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

function parseRealmId(uri: URL, params: Record<string, string | undefined>): number {
  const value = params.realmId ?? uri.pathname.split("/").pop() ?? "";
  const realmId = Number(value);

  if (!Number.isFinite(realmId)) {
    throw new Error(`Invalid realm id: ${value}`);
  }

  return realmId;
}

export function registerRealmResource(server: McpServer, context: ServerContext): void {
  const template = new ResourceTemplate("eternum://realms/{realmId}", { list: undefined });

  server.registerResource(
    "realms",
    template,
    {
      title: "Eternum Realms",
      description: "Realm state summaries",
    },
    async (uri, params) => {
      const realmId = parseRealmId(uri, params ?? {});
      const summary = await context.torii.getRealmSummary(realmId);

      if (!summary) {
        throw new Error(`Realm ${realmId} not found`);
      }

      return jsonResource(uri, {
        realm: summary,
      });
    },
  );
}
