import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

function parseAddress(uri: URL, params: Record<string, string | undefined>): string {
  const address = params.address ?? uri.pathname.split("/").pop() ?? "";

  if (!address) {
    throw new Error(`Missing player address in URI: ${uri.href}`);
  }

  return address;
}

export function registerPlayerResource(server: McpServer, context: ServerContext): void {
  const template = new ResourceTemplate("eternum://players/{address}", { list: undefined });

  server.registerResource(
    "players",
    template,
    {
      title: "Eternum Players",
      description: "Player summaries",
    },
    async (uri, params) => {
      const address = parseAddress(uri, params ?? {});
      const profile = await context.torii.getPlayerProfile(address);

      if (!profile) {
        throw new Error(`Player ${address} not found`);
      }

      return jsonResource(uri, {
        profile,
      });
    },
  );
}
