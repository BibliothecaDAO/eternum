import type { SQL } from "@realms-world/db";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { and, eq } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { velords_burns } from "@realms-world/db/schema";

/* -------------------------------------------------------------------------- */
/*                          getVelordsBurns Endpoint                          */
/* -------------------------------------------------------------------------- */

const GetVelordsBurnsInput = z.object({
  sender: z.string().optional(),
  startTimestamp: z.date().optional(),
  endTimestamp: z.date().optional(),
});

export const getVelordsBurns = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetVelordsBurnsInput.parse(input))
  .handler(async (ctx) => {
    const { sender } = ctx.data;
    const whereFilter: SQL[] = sender
      ? [eq(velords_burns.source, sender.toLowerCase())]
      : [];
    return db.query.velords_burns.findMany({
      where: and(...whereFilter),
      // You can add orderBy here if needed.
    });
  });

export const getVelordsBurnsQueryOptions = (
  input?: z.infer<typeof GetVelordsBurnsInput>,
) =>
  queryOptions({
    queryKey: ["getVelordsBurns", input],
    queryFn: () => getVelordsBurns({ data: input ?? {} }),
  });
