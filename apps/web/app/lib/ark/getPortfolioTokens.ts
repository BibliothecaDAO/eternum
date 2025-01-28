import type { PortfolioToken } from "@/types/ark";

import type { ArkClient } from "./client";

export interface PortfolioCollectionApiResponse {
  token_count: number;
  data: PortfolioToken[];
  next_page: number | null;
}

interface GetPortfolioActivityParams {
  client: ArkClient;
  walletAddress: string;
  collectionAddress?: string;
  page?: number;
  itemsPerPage?: number;
}

export async function getPortfolioTokens({
  client,
  walletAddress,
  collectionAddress,
  page = 1,
  itemsPerPage = 80,
}: GetPortfolioActivityParams): Promise<PortfolioCollectionApiResponse> {
  const queryParams = [
    `items_per_page=${itemsPerPage}`,
    `page=${page}`,
    collectionAddress && `collection=${collectionAddress}`,
  ];

  try {
    return await client.fetch(
      `/portfolio/${walletAddress}?${queryParams.join("&")}`,
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    console.log(e)
    return {
      data: [],
      next_page: null,
      token_count: 0,
    };
  }
}
