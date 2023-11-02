import { GraphQLClient } from "graphql-request";

const OFFSET = 100;

const client = new GraphQLClient(import.meta.env.VITE_TORII_URL!);

type getEventsQuery = {
  events: {
    total_count: number;
    edges: {
      cursor: string;
      node: Event;
    }[];
  };
};

export type Event = {
  keys: string[];
  data: string[];
};

export const pollForEvents = async (keys: string[], processResults: (event: Event) => void) => {
  let cursor: string | undefined;
  let shouldContinue = true;

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  while (shouldContinue) {
    const queryBuilder = `
    query events {
      events(keys:[${formattedKeys}] ${cursor ? `after: "${cursor}"` : ""} first: ${OFFSET}) {
        total_count
        edges {
            cursor
            node {
                keys
                data
            }
        }
      }
    }`;

    const { events }: getEventsQuery = await client.request(queryBuilder);

    if (events.edges.length < OFFSET) {
      shouldContinue = false;
    } else {
      cursor = events.edges[events.edges.length - 1].cursor;
    }

    events.edges.forEach((edge) => processResults(edge.node));
  }
};
