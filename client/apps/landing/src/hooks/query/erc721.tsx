import { graphql } from "../gql";

export const GET_ACCOUNT_TOKENS = graphql(`
  query getAccountTokens($accountAddress: String!, $offset: Int!, $limit: Int!) {
    tokenBalances(accountAddress: $accountAddress, limit: $limit, offset: $offset) {
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

export const GET_ALL_TOKENS = graphql(`
  query getAllTokens($offset: Int!, $limit: Int!, $contractAddress: String!) {
    tokens(limit: $limit, offset: $offset, contractAddress: $contractAddress) {
      totalCount
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

export const GET_MARKETPLACE_ORDERS = graphql(`
  query getMarketOrders($limit: Int!) {
    marketplaceMarketOrderModelModels(limit: $limit, where: { order: { active: true, collection_id: 1 } }) {
      edges {
        node {
          order_id
          order {
            active
            token_id
            collection_id
            owner
            price
            expiration
          }
        }
      }
    }
  }
`);

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
