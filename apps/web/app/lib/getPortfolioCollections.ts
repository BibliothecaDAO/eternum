import type { PortfolioCollectionsApiResponse } from "@/types/ark";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/start";
import { z } from "zod";

const ARK_MARKETPLACE_API_URL = `https://api.marketplace${
  process.env.VITE_PUBLIC_CHAIN === "sepolia" ? ".dev" : ""
}.arkproject.dev`;

/* -------------------------------------------------------------------------- */
/*                             getRealms Endpoint                             */
/* -------------------------------------------------------------------------- */

const GetPortfolioCollectionsInput = z.object({
  address: z.string().optional(),
  collectionAddress: z.string().optional(),
  itemsPerPage: z.number().optional(),
  page: z.number().optional(),
});

export const getPortfolioCollections = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetPortfolioCollectionsInput.parse(input))
  .handler(async (ctx) => {
    const {
      address,
      collectionAddress,
      itemsPerPage = 100,
      page = 1,
    } = ctx.data;
    console.log(address);
    if (address) {
      const queryParams = [
        `items_per_page=${itemsPerPage}`,
        `page=${page}`,
        collectionAddress ? `collection=${collectionAddress}` : null,
      ]
        .filter(Boolean)
        .join("&");
      console.log(
        `${ARK_MARKETPLACE_API_URL}/portfolio/${address}/collections`,
      );
      const response = await fetch(
        `${ARK_MARKETPLACE_API_URL}/portfolio/${address}/collections`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        },
      );
      const data = (await response.json()) as PortfolioCollectionsApiResponse;
      return data;
    }
    return null;
  });

export const getPortfolioCollectionsQueryOptions = (
  input: z.infer<typeof GetPortfolioCollectionsInput>,
) =>
  queryOptions({
    queryKey: [
      "getPortfolioCollections",
      input.address,
      input.collectionAddress,
      input.page,
      input.itemsPerPage,
    ],
    queryFn: () => getPortfolioCollections({ data: input }),
  });
