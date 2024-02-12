import { GraphQLClient, gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { ReplaySubject, Observable } from "rxjs";
import { getLastLoginTimestamp } from "../hooks/store/useNotificationsStore";
import { MAP_EXPLORED_EVENT } from "@bibliothecadao/eternum";

const MAX_EVENTS = 50;

const client = new GraphQLClient(import.meta.env.VITE_TORII_GRAPHQL!);
const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });

type Event = {
  id: string[];
  keys: string[];
  data: any;
  createdAt: string;
};

type getEventsQuery = {
  events: {
    edges: {
      node: Event;
    }[];
  };
};

export async function createEventSubscription(
  keys: string[],
  addPast: boolean = true,
  maxEvents: number = MAX_EVENTS,
): Promise<Observable<Event | null>> {
  if (keys[0] === MAP_EXPLORED_EVENT) {
    console.log("create entity usbs for", keys);
  }
  const lastUpdate$ = new ReplaySubject<Event | null>();

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  if (addPast) {
    const queryBuilder = `
    query {
      events(keys: [${formattedKeys}] last: ${maxEvents}) {
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

    const { events }: getEventsQuery = await client.request(queryBuilder);

    const timestamps = getLastLoginTimestamp();

    events.edges
      .filter((event) => {
        return dateToTimestamp(event.node.createdAt) > timestamps.lastLoginTimestamp;
      })
      .forEach((event) => {
        if (event.node) {
          lastUpdate$.next(event.node);
        }
      });
  }

  let subscriptionQuery = gql`
    subscription {
      eventEmitted(keys: [${formattedKeys}]) {
        id
        keys
        data
        createdAt
      }
    }
      `;

  wsClient.subscribe(
    {
      query: subscriptionQuery,
    },
    {
      next: ({ data }) => {
        try {
          const event = data?.eventEmitted as Event;
          if (event) {
            lastUpdate$.next(event);
          }
        } catch (error) {
          console.log({ error });
        }
      },
      error: () => console.log("ws error"),
      complete: () => console.log("complete"),
    },
  );
  return lastUpdate$;
}

function dateToTimestamp(dateStr: string): number {
  const date = new Date(`${dateStr}Z`);
  let ts = Math.floor(date.getTime() / 1000);
  return ts;
}
