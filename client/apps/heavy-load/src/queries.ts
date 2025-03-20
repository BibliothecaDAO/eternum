import { StructureType } from "@bibliothecadao/eternum";
import chalk from "chalk";
import type { Account } from "starknet";
import { CONFIG } from "./config";

/**
 * Generic function to execute GraphQL queries
 * @param query The GraphQL query string
 * @param variables Optional variables for the query
 * @returns The query result data
 */
async function executeGraphQLQuery(query: string, variables?: Record<string, any>) {
  // Format the query string (remove excessive whitespace)
  const formattedQuery = query
    .replace(/\n\s+/g, " ") // Replace newlines + spaces with a single space
    .replace(/\s+/g, " ") // Replace multiple spaces with a single space
    .trim(); // Remove leading/trailing whitespace

  // Execute the query
  const response = await fetch(CONFIG.graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: formattedQuery,
      variables: variables || {},
    }),
  });

  // Parse and return the result
  const json: any = await response.json();

  if (json.errors) {
    console.error(chalk.red("GraphQL Error:"), json.errors);
    throw new Error(`GraphQL query failed: ${json.errors[0]?.message || "Unknown error"}`);
  }

  return json.data;
}

/**
 * Get realm entity IDs for a specific account
 */
export async function getRealmEntityIds(account: Account): Promise<number[]> {
  const query = `
      query {
        s1EternumStructureModels(where: {owner: "${account.address}", category: ${StructureType.Realm}}, limit: 100000) {
          edges {
            node {
              entity_id
            }
          }
        }
      }
    `;

  const data = await executeGraphQLQuery(query, { owner: account.address });

  if (!data?.s1EternumStructureModels?.edges) {
    return [];
  }

  return data.s1EternumStructureModels.edges.map((edge: any) => edge.node.entity_id);
}

/**
 * Get all explorer entity IDs
 */
export async function getExplorerEntityIds(realmEntityIds: number[]): Promise<number[]> {
  const realmIdsString = JSON.stringify(realmEntityIds);

  const query = `
      query {
      s1EternumExplorerTroopsModels(where: { ownerIN: ${realmIdsString} }, limit: 100000) {
        edges {
          node {
            explorer_id
          }
        }
      }
    }
    `;

  const data = await executeGraphQLQuery(query);

  if (!data?.s1EternumExplorerTroopsModels?.edges) {
    return [];
  }

  return data.s1EternumExplorerTroopsModels.edges.map((edge: any) => edge.node.explorer_id);
}
