import { graphql } from "../gql";

export const GET_ACCOUNT_TOKENS = graphql(`
  query getAccountTokens($accountAddress: String!) {
    tokenBalances(accountAddress: $accountAddress, limit: 8000) {
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
    tokenTransfers(accountAddress: "0x037c6B561b367a85b68668e8663041b9E2F4199c346FBda97dc0c2167F7A6016", limit: 8000) {
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
