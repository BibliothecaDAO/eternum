import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { errorResponse, formatTransactionHash } from "../utils/mcp.js";

const stealResourceSchema = z.object({
  resourceId: z.number().int().nonnegative(),
  amount: z.number().int().positive(),
});

const joinBattleSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("explorer_vs_explorer"),
    aggressorId: z.number().int().nonnegative(),
    defenderId: z.number().int().nonnegative(),
    defenderDirection: z.number().int(),
    stealResources: z.array(stealResourceSchema).optional().default([]),
  }),
  z.object({
    mode: z.literal("explorer_vs_guard"),
    explorerId: z.number().int().nonnegative(),
    structureId: z.number().int().nonnegative(),
    structureDirection: z.number().int(),
  }),
  z.object({
    mode: z.literal("guard_vs_explorer"),
    structureId: z.number().int().nonnegative(),
    guardSlot: z.number().int().nonnegative(),
    explorerId: z.number().int().nonnegative(),
    explorerDirection: z.number().int(),
  }),
]);

export function registerCombatTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "join_battle",
    {
      title: "Join Battle",
      description: "Join or initiate combat",
      inputSchema: joinBattleSchema,
    },
    async (input) => {
      if (!context.provider) {
        return errorResponse("Combat tools are disabled because no provider account is configured.");
      }

      const payload = joinBattleSchema.parse(input);

      try {
        let receipt;

        switch (payload.mode) {
          case "explorer_vs_explorer":
            receipt = await context.provider.attackExplorerVsExplorer({
              aggressorId: payload.aggressorId,
              defenderId: payload.defenderId,
              defenderDirection: payload.defenderDirection,
              stealResources: payload.stealResources ?? [],
            });
            break;
          case "explorer_vs_guard":
            receipt = await context.provider.attackExplorerVsGuard({
              explorerId: payload.explorerId,
              structureId: payload.structureId,
              structureDirection: payload.structureDirection,
            });
            break;
          case "guard_vs_explorer":
            receipt = await context.provider.attackGuardVsExplorer({
              structureId: payload.structureId,
              guardSlot: payload.guardSlot,
              explorerId: payload.explorerId,
              explorerDirection: payload.explorerDirection,
            });
            break;
          default:
            return errorResponse(`Unsupported combat mode: ${(payload as never).mode}`);
        }

        const hash = formatTransactionHash(receipt);

        return {
          content: [
            {
              type: "text" as const,
              text: hash ? `Combat action submitted. Transaction hash: ${hash}` : "Combat action submitted.",
            },
          ],
        };
      } catch (error) {
        return errorResponse(`Failed to execute combat action: ${(error as Error).message}`);
      }
    },
  );
}
