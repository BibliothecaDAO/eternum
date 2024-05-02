import { GraphQLClient } from "graphql-request";
import { createClient } from "graphql-ws";

export type Event = {
  id: string[];
  keys: string[];
  data: any;
  createdAt: string;
};

export type getEventsQuery = {
  events: {
    edges: {
      node: Event;
    }[];
  };
};

// Initialize and export the GraphQL HTTP client
export const client = new GraphQLClient(import.meta.env.VITE_TORII_GRAPHQL!);

// Initialize and export the GraphQL WebSocket client
export const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });
