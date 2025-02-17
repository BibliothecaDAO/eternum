import type { PortfolioCollectionApiResponse } from "@/types/ark";
import type { SQL } from "@realms-world/db";
import type { paths } from "@reservoir0x/reservoir-sdk";
import { z } from "zod";

import {
  ChainId,
  CollectionAddresses,
  Collections,
} from "@realms-world/constants";
import { and, desc, eq, like, or, sql } from "@realms-world/db";
import {
  realmsBridgeRequests,
  realmsLordsClaims,
  velords_burns,
} from "@realms-world/db/schema";

import { delegatesRouter } from "./router/delegates";
import { t } from "./trpc";

const SUPPORTED_L1_CHAIN_ID =
  process.env.VITE_PUBLIC_CHAIN == "sepolia"
    ? ChainId.SEPOLIA
    : ChainId.MAINNET;
const RESERVOIR_API_URL = `https://api${
  process.env.VITE_PUBLIC_CHAIN === "sepolia" ? "-sepolia" : ""
}.reservoir.tools`;

const ARK_MARKETPLACE_API_URL = `https://api.marketplace${process.env.VITE_PUBLIC_CHAIN === "sepolia" ? ".dev" : ""}.arkproject.dev`;

export const appRouter = t.router({
  realmsLordsClaims: t.procedure
    .input(
      z.object({
        address: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.query.realmsLordsClaims.findMany({
        where: eq(realmsLordsClaims.recipient, input.address),
        orderBy: desc(realmsLordsClaims.timestamp),
      });
    }),
  velordsBurns: t.procedure
    .input(
      z.object({
        sender: z.string().optional(),
        startTimestamp: z.date().optional(),
        endTimestamp: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { sender, startTimestamp, endTimestamp } = input;
      const whereFilter: SQL[] = sender
        ? [eq(velords_burns.source, sender.toLowerCase())]
        : [];
      return ctx.db.query.velords_burns.findMany({
        where: and(...whereFilter),
        //orderBy: desc(realmsLordsClaims.timestamp),
      });
    }),
  bridgeTransactions: t.procedure
    .input(
      z
        .object({
          l1Account: z.string().nullish(),
          l2Account: z.string().nullish(),
        })
        .optional(),
    )
    .query(({ ctx, input }) => {
      const { l1Account, l2Account } = input ?? {};
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
        .optional(),
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
          },
        );
        const data =
          (await response.json()) as paths["/users/{user}/tokens/v10"]["get"]["responses"]["200"]["schema"];
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
        .optional(),
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
          },
        );
        const data = (await response.json()) as PortfolioCollectionApiResponse;
        return data;
      }
    }),
  delegates: delegatesRouter,
});

export type AppRouter = typeof appRouter;
