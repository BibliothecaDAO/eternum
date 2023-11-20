import { gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { BehaviorSubject, Observable } from "rxjs";

type Event = {
  id: string[];
  keys: string[];
  data: any;
  created_at: string;
};

export async function createEventSubscription(keys: string[]): Promise<Observable<Event>> {
  const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });

  const lastUpdate$ = new BehaviorSubject<Event>(null);

  const formattedKeys = keys.map((key) => `"${key}"`).join(",");

  wsClient.subscribe(
    {
      query: gql`
        subscription {
          eventEmitted(keys: [${formattedKeys}]) {
            id
            keys
            data
            created_at
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
