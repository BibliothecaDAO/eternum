import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { createTRPCContext } from "../trpc-server.handler";

export const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});
