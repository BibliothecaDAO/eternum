import { GraphQLClient } from "graphql-request";

// Initialize and export the GraphQL HTTP client
export const client = new GraphQLClient(import.meta.env.VITE_TORII_GRAPHQL!);
