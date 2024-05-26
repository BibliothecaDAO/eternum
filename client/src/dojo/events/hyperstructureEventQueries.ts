import { Event, client, getEventsQuery } from "./graphqlClient";
import { HYPERSTRUCTURE_FINISHED_EVENT } from "@bibliothecadao/eternum";

export const MAX_EVENTS = 5000;

export interface HyperstructureEventInterface {
  hyperstructureEntityId: bigint;
  timestamp: number;
}

export async function getHyperstructureEvents() {
  const query = `
    query GetBankEvents {
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

function parseHyperstructureFinishedEventData(eventData: Event) {
  const [hyperstructureEntityId, timestamp] = eventData.data;

  return {
    hyperstructureEntityId: BigInt(hyperstructureEntityId),
    timestamp: Number(timestamp),
  };
}
