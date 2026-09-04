import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { desc, eq, realmsLordsClaims } from "@realms-world/db";
import { db } from "@realms-world/db/client";

/* -------------------------------------------------------------------------- */
/*                    getRealmsLordsClaims Endpoint                         */
/* -------------------------------------------------------------------------- */

const GetRealmsLordsClaimsInput = z.object({
  address: z.string().optional(),
});

export const getRealmsLordsClaims = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => GetRealmsLordsClaimsInput.parse(input))
  .handler(async (ctx) => {
    const { address } = ctx.data;

    if (!address) {
      return [];
    }

    return db.query.realmsLordsClaims.findMany({
      where: eq(realmsLordsClaims.recipient, address),
      orderBy: desc(realmsLordsClaims.timestamp),
    });
  });

export const getRealmsLordsClaimsQueryOptions = (input: z.infer<typeof GetRealmsLordsClaimsInput>) =>
  queryOptions({
    queryKey: ["getRealmsLordsClaims", input.address],
    queryFn: () => (input.address ? getRealmsLordsClaims({ data: input }) : Promise.resolve([])),
    enabled: !!input.address,
  });
