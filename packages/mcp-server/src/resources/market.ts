import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

export function registerMarketResource(server: McpServer, context: ServerContext): void {
  server.registerResource(
    "market",
    "eternum://market/orders",
    {
      title: "Eternum Market",
      description: "Recent market swap events",
      mimeType: "application/json",
    },
    async (uri) => {
      const swaps = await context.torii.listMarketSwaps();

      return jsonResource(uri, {
        swaps,
        generatedAt: new Date().toISOString(),
      });
    },
  );
}
