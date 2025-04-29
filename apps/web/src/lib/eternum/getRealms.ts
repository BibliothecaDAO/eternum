import type { PortfolioTokensApiResponse } from "@/types/ark";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ARK_MARKETPLACE_API_URL = `https://api.marketplace${
  process.env.VITE_PUBLIC_CHAIN === "sepolia" ? ".dev" : ""
}.arkproject.dev`;

/* -------------------------------------------------------------------------- */
/*                             getRealms Endpoint                             */
/* -------------------------------------------------------------------------- */

const GetRealmsInput = z.object({
  address: z.string().optional(),
  collectionAddress: z.string().optional(),
  itemsPerPage: z.number().optional(),
  page: z.number().optional(),
});

export const getRealms = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetRealmsInput.parse(input))
  .handler(async (ctx) => {
    const {
      address,
      collectionAddress,
      itemsPerPage = 100,
      page = 1,
    } = ctx.data;
    const queryParams = [
      `items_per_page=${itemsPerPage}`,
      `page=${page}`,
      collectionAddress ? `collection=${collectionAddress}` : null,
    ]
      .filter(Boolean)
      .join("&");

    const response = await fetch(
      `${ARK_MARKETPLACE_API_URL}/portfolio/${address}?${queryParams}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
    const data = (await response.json()) as PortfolioTokensApiResponse;
    return data;
  });

export const getRealmsQueryOptions = (input: z.infer<typeof GetRealmsInput>) =>
  queryOptions({
    queryKey: [
      "getRealms",
      input.address,
      input.collectionAddress,
      input.page,
      input.itemsPerPage,
    ],
    queryFn: () => (input.address ? getRealms({ data: input }) : null),
  });
