import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ServerContext } from "../context.js";
import { errorResponse, formatTransactionHash } from "../utils/mcp.js";

const createTradeOrderSchema = z.object({
  makerId: z.number().int().nonnegative(),
  takerId: z.number().int().nonnegative().default(0),
  makerResourceId: z.number().int().nonnegative(),
  makerAmount: z.number().int().positive(),
  makerMaxCount: z.number().int().positive().optional(),
  takerResourceId: z.number().int().nonnegative(),
  takerAmount: z.number().int().positive(),
  expiresAt: z.number().int().positive().optional(),
});

const acceptTradeOrderSchema = z.object({
  tradeId: z.number().int().nonnegative(),
  takerId: z.number().int().nonnegative(),
  takerBuysCount: z.number().int().positive().default(1),
});

export function registerTradingTools(server: McpServer, context: ServerContext): void {
  server.registerTool(
    "create_trade_order",
    {
      title: "Create Trade Order",
      description: "Submit a marketplace order",
      inputSchema: createTradeOrderSchema,
    },
    async (input) => {
      if (!context.provider) {
        return errorResponse("Trade tools are disabled because no provider account is configured.");
      }

      const payload = createTradeOrderSchema.parse(input);

      try {
        const receipt = await context.provider.createTradeOrder({
          makerId: payload.makerId,
          takerId: payload.takerId,
          makerResourceId: payload.makerResourceId,
          makerAmount: payload.makerAmount,
          makerMaxCount: payload.makerMaxCount,
          takerResourceId: payload.takerResourceId,
          takerAmount: payload.takerAmount,
          expiresAt: payload.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
        });

        const hash = formatTransactionHash(receipt);

        return {
          content: [
            {
              type: "text" as const,
              text: hash
                ? `Trade order submitted. Transaction hash: ${hash}`
                : "Trade order submitted.",
            },
          ],
        };
      } catch (error) {
        return errorResponse(`Failed to create trade order: ${(error as Error).message}`);
      }
    },
  );

  server.registerTool(
    "accept_trade_order",
    {
      title: "Accept Trade Order",
      description: "Accept an existing marketplace order",
      inputSchema: acceptTradeOrderSchema,
    },
    async (input) => {
      if (!context.provider) {
        return errorResponse("Trade tools are disabled because no provider account is configured.");
      }

      const payload = acceptTradeOrderSchema.parse(input);

      try {
        const receipt = await context.provider.acceptTradeOrder({
          tradeId: payload.tradeId,
          takerId: payload.takerId,
          takerBuysCount: payload.takerBuysCount,
        });

        const hash = formatTransactionHash(receipt);

        return {
          content: [
            {
              type: "text" as const,
              text: hash
                ? `Trade order ${payload.tradeId} accepted. Transaction hash: ${hash}`
                : `Trade order ${payload.tradeId} accepted.`,
            },
          ],
        };
      } catch (error) {
        return errorResponse(`Failed to accept trade order: ${(error as Error).message}`);
      }
    },
  );
}
