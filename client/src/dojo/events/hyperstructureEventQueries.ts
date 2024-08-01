import { HYPERSTRUCTURE_CO_OWNER_CHANGE, HYPERSTRUCTURE_FINISHED_EVENT, ID } from "@bibliothecadao/eternum";
import { Event } from "./graphqlClient";

const MAX_EVENTS = 5000;

export interface HyperstructureFinishedEventInterface {
  hyperstructureEntityId: ID;
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
    hyperstructureEntityId: ID(hyperstructureEntityId),
    timestamp: Number(timestamp),
  };
}
