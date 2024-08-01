import { numberToHex } from "@/ui/utils/utils";
import { ID, PILLAGE_EVENT } from "@bibliothecadao/eternum";
import { client, getEventsQuery } from "./graphqlClient";

export async function getPillageEvents(realmId: ID): Promise<number> {
  const query = `
    query {
      events(keys: ["${PILLAGE_EVENT}","*","${numberToHex(Number(realmId))}"]) {
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
