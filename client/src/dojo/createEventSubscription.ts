import { GraphQLClient, gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { ReplaySubject, Observable } from "rxjs";
import { getLastLoginTimestamp } from "../hooks/store/useNotificationsStore";

const MAX_EVENTS = 50;

const client = new GraphQLClient(import.meta.env.VITE_TORII_GRAPHQL!);

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

export async function createEventSubscription(keys: string[]): Promise<Observable<Event | null>> {
  const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });

  const lastUpdate$ = new ReplaySubject<Event | null>();

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  const queryBuilder = `
    query {
      events(keys: [${formattedKeys}] last: ${MAX_EVENTS}) {
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

  wsClient.subscribe(
    {
      query: gql`
        subscription {
          eventEmitted(keys: [${formattedKeys}]) {
            id
            keys
            data
            createdAt
          }
        }
      `,
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
      error: (error) => console.log({ error }),
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
