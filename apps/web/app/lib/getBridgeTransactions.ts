import type { SQL } from "@realms-world/db";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/start";
import { z } from "zod";

import { desc, eq, or } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { realmsBridgeRequests } from "@realms-world/db/schema";

/* -------------------------------------------------------------------------- */
/*                         getBridgeTransactions Endpoint                     */
/* -------------------------------------------------------------------------- */

const GetBridgeTransactionsInput = z.object({
  l1Account: z.string().nullable().optional(),
  l2Account: z.string().nullable().optional(),
});

export const getBridgeTransactions = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetBridgeTransactionsInput.parse(input))
  .handler(async (ctx) => {
    const { l1Account, l2Account } = ctx.data;
    const whereFilter: SQL[] = [];

    if (l1Account) {
      whereFilter.push(
        eq(realmsBridgeRequests.from_address, l1Account.toLowerCase()),
        eq(realmsBridgeRequests.to_address, l1Account.toLowerCase()),
      );
    }
    if (l2Account) {
      whereFilter.push(
        eq(realmsBridgeRequests.from_address, l2Account.toLowerCase()),
        eq(realmsBridgeRequests.to_address, l2Account.toLowerCase()),
      );
    }
    return db.query.realmsBridgeRequests.findMany({
      where: or(...whereFilter),
      orderBy: desc(realmsBridgeRequests.timestamp),
      with: {
        events: true,
      },
    });
  });

export const getBridgeTransactionsQueryOptions = (
  input?: z.infer<typeof GetBridgeTransactionsInput>,
) =>
  queryOptions({
    queryKey: ["getBridgeTransactions", input],
    queryFn: () =>
      !!input?.l2Account || !!input?.l1Account
        ? getBridgeTransactions({ data: input })
        : null,
    enabled: !!input?.l2Account || !!input?.l1Account,
    refetchInterval: 10000,
  });
