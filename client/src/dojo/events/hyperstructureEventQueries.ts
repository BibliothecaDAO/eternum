import { HYPERSTRUCTURE_CO_OWNER_CHANGE, HYPERSTRUCTURE_FINISHED_EVENT } from "@bibliothecadao/eternum";
import { Event } from "./graphqlClient";

export const MAX_EVENTS = 5000;

export interface HyperstructureFinishedEventInterface {
  createdAt: string;
  hyperstructureEntityId: bigint;
  timestamp: number;
}

export interface HyperstructureCoOwnersChangeInterface {
  createdAt: string;
  hyperstructureEntityId: bigint;
  co_owners: { address: string; percentage: number }[];
  timestamp: number;
}

export interface HyperstructureEventInterface {
  eventsFinished: HyperstructureFinishedEventInterface[];
  eventsCoOwnersChange: HyperstructureCoOwnersChangeInterface[];
}

export type HyperstructureEventsQuery = {
  hyperstructureFinishedEvents: {
    edges: {
      node: Event;
    }[];
  };
  hyperstructureCoOwnerChangeEvents: {
    edges: {
      node: Event;
    }[];
  };
};

export async function getHyperstructureEvents() {
  const query = `
	query getHyperstructureEvents {
	hyperstructureFinishedEvents: events(keys: ["${HYPERSTRUCTURE_FINISHED_EVENT}"], last: ${MAX_EVENTS}) {
		edges {
		node {
			id
			keys
			data
			createdAt
		}
		}
	}
	hyperstructureCoOwnerChangeEvents: events(keys: ["${HYPERSTRUCTURE_CO_OWNER_CHANGE}"], last: ${MAX_EVENTS}) {
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

	

}

export function parseHyperstructureFinishedEventData(eventData: Event): HyperstructureFinishedEventInterface {
  const [hyperstructureEntityId, timestamp] = eventData.data;

  return {
    createdAt: eventData.createdAt,
    hyperstructureEntityId: BigInt(hyperstructureEntityId),
    timestamp: Number(timestamp),
  };
}
