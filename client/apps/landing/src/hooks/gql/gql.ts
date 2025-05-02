/* eslint-disable */
import * as types from './graphql';



/**
 * Map of all GraphQL operations in the project.
 *
 * This map has several performance disadvantages:
 * 1. It is not tree-shakeable, so it will include all operations in the project.
 * 2. It is not minifiable, so the string of a GraphQL query will be multiple times inside the bundle.
 * 3. It does not support dead code elimination, so it will add unused operations.
 *
 * Therefore it is highly recommended to use the babel or swc plugin for production.
 * Learn more about it here: https://the-guild.dev/graphql/codegen/plugins/presets/preset-client#reducing-bundle-size
 */
const documents = {
    "\n  query getAccountTokens($accountAddress: String!, $offset: Int!, $limit: Int!) {\n    tokenBalances(accountAddress: $accountAddress, limit: $limit, offset: $offset) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetAccountTokensDocument,
    "\n  query getAllTokens($offset: Int!, $limit: Int!, $contractAddress: String!) {\n    tokens(limit: $limit, offset: $offset, contractAddress: $contractAddress) {\n      totalCount\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetAllTokensDocument,
    "\n  query getMarketOrders($limit: Int!) {\n    marketplaceMarketOrderModelModels(limit: $limit, where: { order: { active: true, collection_id: 1 } }) {\n      edges {\n        node {\n          order_id\n          order {\n            active\n            token_id\n            collection_id\n            owner\n            price\n            expiration\n          }\n        }\n      }\n    }\n  }\n": types.GetMarketOrdersDocument,
    "\n  query getERC721Mints {\n    tokenTransfers(accountAddress: \"0x0\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetErc721MintsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getAccountTokens($accountAddress: String!, $offset: Int!, $limit: Int!) {\n    tokenBalances(accountAddress: $accountAddress, limit: $limit, offset: $offset) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetAccountTokensDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getAllTokens($offset: Int!, $limit: Int!, $contractAddress: String!) {\n    tokens(limit: $limit, offset: $offset, contractAddress: $contractAddress) {\n      totalCount\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetAllTokensDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getMarketOrders($limit: Int!) {\n    marketplaceMarketOrderModelModels(limit: $limit, where: { order: { active: true, collection_id: 1 } }) {\n      edges {\n        node {\n          order_id\n          order {\n            active\n            token_id\n            collection_id\n            owner\n            price\n            expiration\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetMarketOrdersDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getERC721Mints {\n    tokenTransfers(accountAddress: \"0x0\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetErc721MintsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
