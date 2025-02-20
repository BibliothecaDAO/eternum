import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/start";
import { z } from "zod";

import { desc, eq } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { realmsLordsClaims } from "@realms-world/db/schema";

/* -------------------------------------------------------------------------- */
/*                    getRealmsLordsClaims Endpoint                         */
/* -------------------------------------------------------------------------- */

const GetRealmsLordsClaimsInput = z.object({
  address: z.string(),
});

export const getRealmsLordsClaims = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetRealmsLordsClaimsInput.parse(input))
  .handler(async (ctx) => {
    const { address } = ctx.data;
    return db.query.realmsLordsClaims.findMany({
      where: eq(realmsLordsClaims.recipient, address),
      orderBy: desc(realmsLordsClaims.timestamp),
    });
  });

export const getRealmsLordsClaimsQueryOptions = (
  input: z.infer<typeof GetRealmsLordsClaimsInput>,
) =>
  queryOptions({
    queryKey: ["getRealmsLordsClaims", input.address],
    queryFn: () => getRealmsLordsClaims({ data: input }),
  });
