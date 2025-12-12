import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { StructureType } from "@bibliothecadao/types";

import type { ServerContext } from "../context.js";
import { errorResponse, formatTransactionHash } from "../utils/mcp.js";

const upgradeStructureSchema = z.object({
  structureId: z.number().int().nonnegative(),
  structureType: z.nativeEnum(StructureType).optional(),
});

export function registerStructureTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "upgrade_structure",
    {
      title: "Upgrade Structure",
      description: "Upgrade a realm or building",
      inputSchema: upgradeStructureSchema,
    },
    async (input) => {
      if (!context.provider) {
        return errorResponse("Structure tools are disabled because no provider account is configured.");
      }

      const payload = upgradeStructureSchema.parse(input);

      const structure = await context.torii.getRealmSummary(payload.structureId);
      if (!structure) {
        return errorResponse(`Structure ${payload.structureId} not found or is not a realm.`);
      }

      if (payload.structureType && payload.structureType !== structure.structureType) {
        return errorResponse(
          `Structure ${payload.structureId} type mismatch. Expected ${structure.structureType}, received ${payload.structureType}.`,
        );
      }

      try {
        const receipt = await context.provider.upgradeRealm({
          realmEntityId: payload.structureId,
        });

        const hash = formatTransactionHash(receipt);

        return {
          content: [
            {
              type: "text" as const,
              text: hash
                ? `Upgrade submitted for structure ${payload.structureId}. Transaction hash: ${hash}`
                : `Upgrade submitted for structure ${payload.structureId}.`,
            },
          ],
        };
      } catch (error) {
        return errorResponse(`Failed to upgrade structure: ${(error as Error).message}`);
      }
    },
  );
}
