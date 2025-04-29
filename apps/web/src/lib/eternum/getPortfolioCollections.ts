//import type { AccountTokensApiResponse } from "@/types/ark";
import { graphql } from "@/gql/eternum";
import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { executeTorii } from "../queries/torii";
import { formatAddress, SUPPORTED_L2_CHAIN_ID } from "@/utils/utils";
import { CollectionAddresses } from "@realms-world/constants";

export const GET_ACCOUNT_TOKENS = graphql(`
  query getAccountTokens($address: String!) {
    tokenBalances(accountAddress: $address, limit: 8000) {
      edges {
        node {
          tokenMetadata {
            __typename
            ... on ERC721__Token {
              tokenId
              metadataDescription
              imagePath
              contractAddress
              metadata
            }
          }
        }
      }
    }
  }
`);

/* -------------------------------------------------------------------------- */
/*                             getAccountTokens Endpoint                             */
/* -------------------------------------------------------------------------- */

const GetAccountTokensInput = z.object({
  address: z.string().optional(),
  collectionAddress: z.string().optional(),
  itemsPerPage: z.number().optional(),
  page: z.number().optional(),
});

export const getAccountTokens = createServerFn({ method: "GET" })
  .validator((input: unknown) => GetAccountTokensInput.parse(input))
  .handler(async (ctx) => {
    const {
      address,
      collectionAddress,
      itemsPerPage = 100,
      page = 1,
    } = ctx.data;
    /*const queryParams = [
      `items_per_page=${itemsPerPage}`,
      `page=${page}`,
      collectionAddress ? `collection=${collectionAddress}` : null,
    ]
      .filter(Boolean)
      .join("&");*/

    const response = await executeTorii(GET_ACCOUNT_TOKENS, {
      address: address,
    });
    console.log(response);
    return (
      response.tokenBalances?.edges.filter((edge) => {
        return (
          edge.node.tokenMetadata.__typename === "ERC721__Token" &&
          formatAddress(edge.node.tokenMetadata.contractAddress) ===
            (CollectionAddresses.realms[SUPPORTED_L2_CHAIN_ID] as string)
        );
      }) ?? []
    );
  });

export const getAccountTokensQueryOptions = (
  input: z.infer<typeof GetAccountTokensInput>,
) =>
  queryOptions({
    queryKey: [
      "getAccountTokens",
      input.address,
      input.collectionAddress,
      input.page,
      input.itemsPerPage,
    ],
    queryFn: () =>
      input.address
        ? getAccountTokens({ data: { address: input.address } })
        : null,
  });
