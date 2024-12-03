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
    "\n  query getAccountTokens($accountAddress: String!) {\n    tokenBalances(accountAddress: $accountAddress, limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetAccountTokensDocument,
    "\n  query getRealmMints {\n    tokenTransfers(accountAddress: \"0x037c6B561b367a85b68668e8663041b9E2F4199c346FBda97dc0c2167F7A6016\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetRealmMintsDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getAccountTokens($accountAddress: String!) {\n    tokenBalances(accountAddress: $accountAddress, limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetAccountTokensDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getRealmMints {\n    tokenTransfers(accountAddress: \"0x037c6B561b367a85b68668e8663041b9E2F4199c346FBda97dc0c2167F7A6016\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetRealmMintsDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
