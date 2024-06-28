import { numberToHex } from "@/ui/utils/utils";
import { client, getEventsQuery } from "./graphqlClient";
import { PILLAGE_EVENT } from "@bibliothecadao/eternum";

export async function getPillageEvents(realmId: bigint): Promise<number> {
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
