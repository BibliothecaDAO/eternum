import { HYPERSTRUCTURE_FINISHED_EVENT, ID } from "@bibliothecadao/eternum";
import { Event, client, getEventsQuery } from "./graphqlClient";

const MAX_EVENTS = 5000;

export interface HyperstructureEventInterface {
  hyperstructureEntityId: ID;
  timestamp: number;
}

export async function getHyperstructureEvents(): Promise<HyperstructureEventInterface[]> {
  const query = `
    query getHyperstructureEvents {
      events(keys: ["${HYPERSTRUCTURE_FINISHED_EVENT}"], last: ${MAX_EVENTS}) {
        edges {
          node {
            id
            keys
            data
            createdAt
          }
        }
      }
    }
  `;

  const response = await client.request<getEventsQuery>(query);
  const { events } = response;

  return events.edges.map(({ node }) => {
    return parseHyperstructureFinishedEventData(node);
  });
}

export function parseHyperstructureFinishedEventData(eventData: Event): HyperstructureEventInterface {
  const [hyperstructureEntityId, timestamp] = eventData.data;

  return {
    hyperstructureEntityId: hyperstructureEntityId,
    timestamp: Number(timestamp),
  };
}
