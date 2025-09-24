import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { jsonResource } from "../utils/mcp.js";

function parseCoords(uri: URL, params: Record<string, string | undefined>): { x: number; y: number } {
  const xRaw = params.x;
  const yRaw = params.y ?? (params.x && params.x.includes(",") ? params.x.split(",")[1] : undefined);

  let x = Number(xRaw);
  let y = Number(yRaw);

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    const fallback = uri.pathname.split("/").pop() ?? "";
    const [fx, fy] = fallback.split(",");
    x = Number(fx);
    y = Number(fy);
  }

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Invalid tile coordinates in URI: ${uri.href}`);
  }

  return { x, y };
}

export function registerTileResource(server: McpServer, context: ServerContext): void {
  const template = new ResourceTemplate("eternum://tiles/{x},{y}", { list: undefined });

  server.registerResource(
    "tiles",
    template,
    {
      title: "Eternum Tiles",
      description: "Tile level information",
    },
    async (uri, params) => {
      const { x, y } = parseCoords(uri, params ?? {});
      const summary = await context.torii.getTileSummary(x, y);

      if (!summary) {
        throw new Error(`Tile ${x},${y} not found`);
      }

      return jsonResource(uri, {
        tile: summary,
      });
    },
  );
}
