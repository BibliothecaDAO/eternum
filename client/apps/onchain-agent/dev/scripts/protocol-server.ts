/**
 * Standalone Map Protocol HTTP server.
 *
 * Connects to Torii, builds a MapSnapshot, exposes MapProtocol operations
 * as a simple HTTP API so any client can query the game world.
 *
 * Usage: npx tsx dev/scripts/protocol-server.ts
 */

import { createServer } from "node:http";
import { EternumClient } from "@bibliothecadao/client";
import { renderMap } from "../../src/map/renderer.js";
import { createMapProtocol } from "../../src/map/protocol.js";
import type { MapProtocol } from "../../src/map/protocol.js";

const TORII_URL = "https://api.cartridge.gg/x/test-axis-slotty/torii";
const PORT = 3117;

let protocol: MapProtocol | null = null;
let lastRefresh: Date | null = null;
let tileCount = 0;

async function refresh(client: EternumClient) {
  const area = await client.view.mapArea({ x: 0, y: 0, radius: 999_999 });
  tileCount = area.tiles.length;

  // Render snapshot (we need MapSnapshot for the protocol)
  const snapshot = renderMap(area.tiles);

  // Pass the client so tileInfo/entityInfo can do live fetches
  protocol = createMapProtocol(snapshot, new Set(), undefined, client);
  lastRefresh = new Date();
  console.log(`[refresh] ${tileCount} tiles, protocol ready`);
}

async function main() {
  console.log(`Connecting to ${TORII_URL}...`);
  const client = await EternumClient.create({ toriiUrl: TORII_URL });
  console.log("Client created. Fetching initial map...");

  await refresh(client);

  // Refresh every 30s
  setInterval(() => refresh(client).catch((e) => console.error("refresh error:", e)), 30_000);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    const path = url.pathname;

    res.setHeader("Content-Type", "application/json");

    if (!protocol) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: "Map not loaded yet" }));
      return;
    }

    try {
      if (path === "/tile_info") {
        const x = Number(url.searchParams.get("x"));
        const y = Number(url.searchParams.get("y"));
        if (isNaN(x) || isNaN(y)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "x and y required" }));
          return;
        }
        const result = await protocol.tileInfo(x, y);
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      if (path === "/nearby") {
        const x = Number(url.searchParams.get("x"));
        const y = Number(url.searchParams.get("y"));
        const radius = Number(url.searchParams.get("radius") ?? "5");
        if (isNaN(x) || isNaN(y)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "x and y required" }));
          return;
        }
        res.writeHead(200);
        const nearbyResult = await protocol.nearby(x, y, radius);
        res.end(JSON.stringify(nearbyResult, null, 2));
        return;
      }

      if (path === "/entity_info") {
        const id = Number(url.searchParams.get("entity_id"));
        if (isNaN(id)) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "entity_id required" }));
          return;
        }
        const result = await protocol.entityInfo(id);
        if (!result) {
          res.writeHead(404);
          res.end(JSON.stringify({ error: `Entity ${id} not found` }));
          return;
        }
        res.writeHead(200);
        res.end(JSON.stringify(result, null, 2));
        return;
      }

      if (path === "/find") {
        const type = url.searchParams.get("type");
        if (!type) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: "type required", options: ["hyperstructure", "mine", "village", "chest", "enemy_army", "enemy_structure", "own_army", "own_structure"] }));
          return;
        }
        const refX = url.searchParams.get("ref_x");
        const refY = url.searchParams.get("ref_y");
        const ref = refX && refY ? { x: Number(refX), y: Number(refY) } : undefined;
        const findResult = await protocol.find(type as any, ref);
        res.writeHead(200);
        res.end(JSON.stringify(findResult, null, 2));
        return;
      }

      if (path === "/diagnostics") {
        res.writeHead(200);
        res.end(JSON.stringify(protocol.diagnostics(), null, 2));
        return;
      }

      if (path === "/briefing") {
        res.setHeader("Content-Type", "text/plain");
        res.writeHead(200);
        res.end(protocol.briefing());
        return;
      }

      if (path === "/status") {
        res.writeHead(200);
        res.end(JSON.stringify({ tiles: tileCount, lastRefresh: lastRefresh?.toISOString(), uptime: process.uptime() }, null, 2));
        return;
      }

      // Root — list endpoints
      res.writeHead(200);
      res.end(JSON.stringify({
        endpoints: {
          "/tile_info?x=&y=": "What's at this position?",
          "/nearby?x=&y=&radius=5": "What's around here?",
          "/entity_info?entity_id=": "Full details on an entity",
          "/find?type=&ref_x=&ref_y=": "Find entities by type",
          "/diagnostics": "Current threats & opportunities",
          "/briefing": "Compact tick context (text)",
          "/status": "Server status",
        },
      }, null, 2));
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(PORT, () => {
    console.log(`Map Protocol server running at http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
