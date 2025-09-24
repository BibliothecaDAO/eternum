import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

export function registerBattleLogResource(server: McpServer, context: ServerContext): void {
  server.registerResource(
    "battle-logs",
    "eternum://battles/logs",
    {
      title: "Eternum Battle Logs",
      description: "Chronological combat events",
      mimeType: "application/json",
    },
    async (uri) => {
      const afterParam = uri.searchParams.get("after");
      const afterTimestamp = afterParam ? Number(afterParam) : undefined;

      if (afterTimestamp !== undefined && !Number.isFinite(afterTimestamp)) {
        throw new Error(`Invalid 'after' query parameter: ${afterParam}`);
      }

      const logs = await context.torii.listBattleLogs(afterTimestamp);

      return jsonResource(uri, {
        after: afterTimestamp,
        logs,
        generatedAt: new Date().toISOString(),
      });
    },
  );
}
