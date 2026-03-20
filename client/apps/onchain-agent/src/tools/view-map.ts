/**
 * `view_map` tool — return the current ASCII map.
 *
 * The map is already included in each tick prompt automatically. This tool
 * provides a refreshed view after moves or explores change the map mid-tick.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { MapContext } from "../map/context.js";

/**
 * Create the view_map agent tool.
 *
 * @param mapCtx - Map context holding the current tile snapshot and its ASCII text representation.
 * @returns An AgentTool that returns the current ASCII map text, or a "not loaded" message if no snapshot is available.
 */
export function createViewMapTool(mapCtx: MapContext): AgentTool<any> {
  return {
    name: "view_map",
    label: "View Map",
    description:
      "Get the current ASCII map with all explored tiles, your armies, structures, and points of interest. " +
      "The map is included in each tick prompt automatically, but use this to see a refreshed view after moves.",
    parameters: Type.Object({}),
    async execute() {
      if (!mapCtx.snapshot) {
        return {
          content: [{ type: "text" as const, text: "Map not loaded yet." }],
          details: {},
        };
      }

      return {
        content: [{ type: "text" as const, text: mapCtx.snapshot.text }],
        details: { tileCount: mapCtx.snapshot.tiles.length },
      };
    },
  };
}
