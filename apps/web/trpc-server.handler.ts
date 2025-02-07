import type { paths } from "@reservoir0x/reservoir-sdk";
import { defineEventHandler, toWebRequest } from "@tanstack/start/server";
import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z, ZodError } from "zod";
import superjson from "superjson";
import type { SQL } from "@realms-world/db";

import { eq, or, desc } from "@realms-world/db";
import { db } from "@realms-world/db/client";
import { realmsBridgeRequests } from "@realms-world/db/schema";
import {
  CollectionAddresses,
  Collections,
  ChainId,
} from "@realms-world/constants";
import type { PortfolioCollectionApiResponse } from "@/types/ark";
const SUPPORTED_L1_CHAIN_ID =
  process.env.VITE_PUBLIC_CHAIN == "sepolia"
    ? ChainId.SEPOLIA
    : ChainId.MAINNET;
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

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

const POSTS = [
  { id: "1", title: "First post" },
  { id: "2", title: "Second post" },
  { id: "3", title: "Third post" },
  { id: "4", title: "Fourth post" },
  { id: "5", title: "Fifth post" },
  { id: "6", title: "Sixth post" },
  { id: "7", title: "Seventh post" },
  { id: "8", title: "Eighth post" },
  { id: "9", title: "Ninth post" },
  { id: "10", title: "Tenth post" },
];

const RESERVOIR_API_URL = `https://api${
  process.env.VITE_PUBLIC_CHAIN === "sepolia" ? "-sepolia" : ""
}.reservoir.tools`;

const ARK_MARKETPLACE_API_URL = `https://api.marketplace${process.env.VITE_PUBLIC_CHAIN === "sepolia" ? ".dev" : ""}.arkproject.dev`;

const appRouter = t.router({
  hello: t.procedure.query(() => "Hello world!"),
  posts: t.procedure.query(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return POSTS;
  }),
  bridgeTransactions: t.procedure
    .input(
      z
        .object({
          l1Account: z.string().nullish(),
          l2Account: z.string().nullish(),
        })
        .optional()
    )
    .query(({ ctx, input }) => {
      const { l1Account, l2Account } = input ?? {};
      const whereFilter: SQL[] = [];
      if (l1Account) {
        whereFilter.push(
          eq(realmsBridgeRequests.from_address, l1Account.toLowerCase()),
          eq(realmsBridgeRequests.to_address, l1Account.toLowerCase())
        );
      }
      if (l2Account) {
        whereFilter.push(
          eq(realmsBridgeRequests.from_address, l2Account.toLowerCase()),
          eq(realmsBridgeRequests.to_address, l2Account.toLowerCase())
        );
      }
      return ctx.db.query.realmsBridgeRequests.findMany({
        where: or(...whereFilter),
        orderBy: desc(realmsBridgeRequests.timestamp),
        with: {
          events: true,
        },
      });
    }),
  l1Realms: t.procedure
    .input(
      z
        .object({
          address: z.string().optional(),
        })
        .optional()
    )
    .query(async (req) => {
      if (req.input?.address) {
        const response = await fetch(
          `${RESERVOIR_API_URL}/users/${req.input.address}/tokens/v10?collection=${CollectionAddresses[Collections.REALMS][SUPPORTED_L1_CHAIN_ID]}&limit=100&includeAttributes=true`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.VITE_RESERVOIR_API_KEY ?? "",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
        const data = await response.json() as paths["/users/{user}/tokens/v10"]["get"]["responses"]["200"]["schema"];
        return data;
      }
    }),
  realms: t.procedure
    .input(
      z
        .object({
          address: z.string().optional(),
          collectionAddress: z.string().optional(),
          itemsPerPage: z.number().optional().default(100),
          page: z.number().optional().default(1),
        })
        .optional()
    )
    .query(async (req) => {
      if (req.input?.address) {
        const { address, itemsPerPage, page, collectionAddress } = req.input;
        const queryParams = [
          `items_per_page=${itemsPerPage}`,
          `page=${page}`,
          collectionAddress && `collection=${collectionAddress}`,
        ];
        const response = await fetch(
          `${ARK_MARKETPLACE_API_URL}/portfolio/${address}?${queryParams.join("&")}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
        const data = await response.json() as PortfolioCollectionApiResponse;
        return data;
      }
    }),
});

export type AppRouter = typeof appRouter;

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
