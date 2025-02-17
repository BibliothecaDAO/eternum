import { defineEventHandler, toWebRequest } from "@tanstack/start/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { db } from "@realms-world/db/client";

import { appRouter } from "./trpc";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = (opts: {
  headers: Headers;
  //session: any | null;
}) => {
  //const session = opts.session;
  const source = opts.headers.get("x-trpc-source") ?? "unknown";
  console.log(">>> tRPC Request from", source, "by" /*, session?.user*/);

  return {
    // session,
    db,
  };
};

export default defineEventHandler((event) => {
  const request = toWebRequest(event);
  if (request) {
    return fetchRequestHandler({
      endpoint: "/trpc",
      req: request,
      router: appRouter,
      createContext() {
        const heads = new Headers(request.headers);
        heads.set("x-trpc-source", "rsc");

        return createTRPCContext({
          //session: await auth(),
          headers: heads,
        });
      },
    });
  }
});
