import { numberToHex } from "@/ui/utils/utils";
import { ID } from "@bibliothecadao/eternum";
import { client, getEventsQuery } from "./graphqlClient";
import { PILLAGE_SELECTOR } from "@/constants/events";

export async function getPillageEvents(realmId: ID): Promise<number> {
  const query = `
    query {
      events(keys: ["${PILLAGE_SELECTOR}","*","${numberToHex(Number(realmId))}"]) {
        edges {
          node {
            id
          }
        }
      }
    }
  `;

  const response = await client.request<getEventsQuery>(query);
  const { events } = response;

  return events.edges.length;
}
