import { z } from "zod";

import { and, desc, eq, like, sql } from "@realms-world/db";
import { delegates } from "@realms-world/db/schema";

import { t } from "../trpc";

export const delegatesRouter = t.router({
  // Returns all delegates (with optional pagination / filters)
  all: t.procedure
    .input(
      z.object({
        limit: z.number().min(1).max(300).optional(),
        cursor: z.number().optional(),
        orderBy: z.string().optional(),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const limit = input.limit ?? 100;
      const { orderBy, search } = input;
      const whereFilter = [];

      if (search) {
        whereFilter.push(like(delegates.id, `%${search}%`));
      }

      const items = await ctx.db.query.delegates.findMany({
        limit: limit + 1,
        where: and(...whereFilter),
        orderBy:
          orderBy === "desc" ? desc(delegates.delegatedVotes) : sql`RANDOM()`,
        with: {
          delegateProfile: true,
        },
      });

      let nextCursor = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = parseInt(nextItem?.delegatedVotes ?? "0");
      }

      return { items, nextCursor };
    }),

  // Returns a specific delegate by its ID
  byID: t.procedure
    .input(z.object({ address: z.string() }))
    .query(async ({ ctx, input }) => {
      console.log(input.address);
      return ctx.db.query.delegates.findFirst({
        where: and(
          eq(delegates.user, input.address),
          sql`upper_inf(block_range)`,
        ),
        with: { delegateProfile: true },
      });
    }),
});
