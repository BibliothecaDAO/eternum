import { graphql } from "../gql";

export const GET_ERC_MINTS = graphql(`
  query getERC721Mints {
    tokenTransfers(accountAddress: "0x0", limit: 8000) {
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
