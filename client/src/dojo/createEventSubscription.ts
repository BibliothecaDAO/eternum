import { COMBAT_EVENT } from "@bibliothecadao/eternum";
import { gql } from "graphql-request";
import { createClient } from "graphql-ws";
import { BehaviorSubject, Observable } from "rxjs";

type Event = {
  id: string[];
  keys: string[];
  data: any;
  created_at: string;
};

export async function createEventSubscription(keys: string[]): Promise<Observable<Event | null>> {
  const wsClient = createClient({ url: import.meta.env.VITE_TORII_WS });

  const lastUpdate$ = new BehaviorSubject<Event | null>(null);

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
            if (keys.includes(COMBAT_EVENT)) {
            }
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
