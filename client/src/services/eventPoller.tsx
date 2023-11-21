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

// todo: put that in one other file
export const pollForEvents = async (
  keys: string[],
  processResults: (event: Event) => void,
  max?: number | undefined,
) => {
  let cursor: string | undefined;
  let shouldContinue = true;
  let processedEvents = 0;

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  while (shouldContinue && (max === undefined || processedEvents < max)) {
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

    events.edges.forEach((edge) => {
      processResults(edge.node);
      processedEvents++;
    });
  }
};
