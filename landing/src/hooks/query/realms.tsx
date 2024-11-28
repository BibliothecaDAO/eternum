import { graphql } from "../gql";

export const GET_REALMS = graphql(`
  query getRealms($accountAddress: String!) {
    tokenBalances(accountAddress: $accountAddress) {
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

export const GET_ERC_MINTS = graphql(`
  query getRealmMints {
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
