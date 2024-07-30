import { gql } from "graphql-request";
import { ReplaySubject, Observable } from "rxjs";
import { Event, client, getEventsQuery, wsClient } from "./graphqlClient";

const MAX_EVENTS = 50;

export async function createEventSubscription(
  keys: string[],
  addPast: boolean = true,
  maxEvents: number = MAX_EVENTS,
): Promise<Observable<Event | null>> {
  const lastUpdate$ = new ReplaySubject<Event | null>();

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  if (addPast) {
    const queryBuilder = `
    query {
      events(keys: [${formattedKeys}] first: ${maxEvents}) {
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

    let edges = events.edges;
    edges.forEach((event) => {
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
      next: ({ data }: any) => {
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
