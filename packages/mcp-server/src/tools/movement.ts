import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { errorResponse, formatTransactionHash } from "../utils/mcp.js";

const moveArmySchema = z.object({
  armyId: z.number().int().nonnegative(),
  directions: z.array(z.number().int()).min(1),
  explore: z.boolean().optional().default(false),
});

export function registerMovementTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "move_army",
    {
      title: "Move Army",
      description: "Move an explorer through the world",
      inputSchema: moveArmySchema,
    },
    async (input) => {
      if (!context.provider) {
        return errorResponse("Movement tools are disabled because no provider account is configured.");
      }

      const payload = moveArmySchema.parse(input);

      const army = await context.torii.getArmySummary(payload.armyId);
      if (!army) {
        return errorResponse(`Army ${payload.armyId} not found or not cached.`);
      }

      try {
        const receipt = await context.provider.moveExplorer({
          explorerId: payload.armyId,
          directions: payload.directions,
          explore: payload.explore,
        });

        const hash = formatTransactionHash(receipt);

        return {
          content: [
            {
              type: "text" as const,
              text: hash
                ? `Army ${payload.armyId} movement submitted. Transaction hash: ${hash}`
                : `Army ${payload.armyId} movement submitted.`,
            },
          ],
        };
      } catch (error) {
        return errorResponse(`Failed to move army: ${(error as Error).message}`);
      }
    },
  );
}
