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
    "\n  query getCapacitySpeedConfig($category: Enum!, $entityType: u32!) {\n    s0EternumCapacityConfigModels(where: {category: $category }) {\n        edges{\n          node {\n           weight_gram\n          }\n        }\n      }\n      s0EternumSpeedConfigModels(where: {entity_type: $entityType }) {\n        edges{\n          node {\n           sec_per_km\n          }\n        }\n      }\n  }\n": types.GetCapacitySpeedConfigDocument,
    "\n  query getEternumOwnerRealmIds($accountAddress: ContractAddress!) {\n    s0EternumOwnerModels(where: { address: $accountAddress }) {\n      edges {\n        node {\n          address\n          entity_id\n          entity {\n            models {\n              __typename\n              ... on s0_eternum_Realm {\n                realm_id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetEternumOwnerRealmIdsDocument,
    "\n  query getEternumEntityOwner($entityOwnerIds: [u32!]!) {\n    s0EternumEntityOwnerModels(where: { entity_owner_idIN: $entityOwnerIds}, limit: 200) {\n      edges {\n        node {\n          entity_id\n          entity_owner_id\n          entity {\n            models {\n              __typename\n              ... on s0_eternum_OwnedResourcesTracker {\n                resource_types\n              }\n              ... on s0_eternum_Position {\n                x\n                y\n              }\n              ... on s0_eternum_ArrivalTime {\n                arrives_at\n              }\n              ... on s0_eternum_Weight {\n                value\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetEternumEntityOwnerDocument,
    "\n  query getAccountTokens($accountAddress: String!) {\n    tokenBalances(accountAddress: $accountAddress, limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetAccountTokensDocument,
    "\n  query getERC721Mints {\n    tokenTransfers(accountAddress: \"0x0\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n": types.GetErc721MintsDocument,
    "\n  query getEntityPosition($entityIds: [u32!]!) {\n    s0EternumPositionModels(where: { entity_idIN: $entityIds }) {\n      edges {\n        node {\n          x\n          y\n          entity_id\n          entity {\n            __typename\n          }\n        }\n      }\n    }\n  }\n": types.GetEntityPositionDocument,
    "\n  query getEntitiesResources($entityIds: [u32!]!) {\n    s0EternumResourceModels(\n      where: { \n        entity_idIN: $entityIds\n      }\n      limit: 100\n    ) {\n      edges {\n        node {\n          entity_id\n          resource_type\n          balance\n          entity {\n            __typename\n          }\n        }\n      }\n    }\n  }\n": types.GetEntitiesResourcesDocument,
};

/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getCapacitySpeedConfig($category: Enum!, $entityType: u32!) {\n    s0EternumCapacityConfigModels(where: {category: $category }) {\n        edges{\n          node {\n           weight_gram\n          }\n        }\n      }\n      s0EternumSpeedConfigModels(where: {entity_type: $entityType }) {\n        edges{\n          node {\n           sec_per_km\n          }\n        }\n      }\n  }\n"): typeof import('./graphql').GetCapacitySpeedConfigDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getEternumOwnerRealmIds($accountAddress: ContractAddress!) {\n    s0EternumOwnerModels(where: { address: $accountAddress }) {\n      edges {\n        node {\n          address\n          entity_id\n          entity {\n            models {\n              __typename\n              ... on s0_eternum_Realm {\n                realm_id\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetEternumOwnerRealmIdsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getEternumEntityOwner($entityOwnerIds: [u32!]!) {\n    s0EternumEntityOwnerModels(where: { entity_owner_idIN: $entityOwnerIds}, limit: 200) {\n      edges {\n        node {\n          entity_id\n          entity_owner_id\n          entity {\n            models {\n              __typename\n              ... on s0_eternum_OwnedResourcesTracker {\n                resource_types\n              }\n              ... on s0_eternum_Position {\n                x\n                y\n              }\n              ... on s0_eternum_ArrivalTime {\n                arrives_at\n              }\n              ... on s0_eternum_Weight {\n                value\n              }\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetEternumEntityOwnerDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getAccountTokens($accountAddress: String!) {\n    tokenBalances(accountAddress: $accountAddress, limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetAccountTokensDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getERC721Mints {\n    tokenTransfers(accountAddress: \"0x0\", limit: 8000) {\n      edges {\n        node {\n          tokenMetadata {\n            __typename\n            ... on ERC721__Token {\n              tokenId\n              metadataDescription\n              imagePath\n              contractAddress\n              metadata\n            }\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetErc721MintsDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getEntityPosition($entityIds: [u32!]!) {\n    s0EternumPositionModels(where: { entity_idIN: $entityIds }) {\n      edges {\n        node {\n          x\n          y\n          entity_id\n          entity {\n            __typename\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetEntityPositionDocument;
/**
 * The graphql function is used to parse GraphQL queries into a document that can be used by GraphQL clients.
 */
export function graphql(source: "\n  query getEntitiesResources($entityIds: [u32!]!) {\n    s0EternumResourceModels(\n      where: { \n        entity_idIN: $entityIds\n      }\n      limit: 100\n    ) {\n      edges {\n        node {\n          entity_id\n          resource_type\n          balance\n          entity {\n            __typename\n          }\n        }\n      }\n    }\n  }\n"): typeof import('./graphql').GetEntitiesResourcesDocument;


export function graphql(source: string) {
  return (documents as any)[source] ?? {};
}
