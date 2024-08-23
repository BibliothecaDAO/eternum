import { DojoConfig } from "@dojoengine/core";
import { getSyncEntities, getSyncEvents } from "@dojoengine/state";
import { createClientComponents } from "./createClientComponents";
import { createSystemCalls } from "./createSystemCalls";
import { createUpdates } from "./createUpdates";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const components = createClientComponents(network);
  const systemCalls = createSystemCalls(network);
  const updates = await createUpdates();

  // fetch all existing entities from torii
  const sync = await getSyncEntities(network.toriiClient, network.contractComponents as any, [], 1000);

  // todo: filter later
  // const timestamp = Math.round(Date.now() / 1000 - 3600); // Subtract 1 hour (3600 seconds)
  // const query = {
  //   Composite: {
  //     operator: "And",
  //     clauses: [
  //       {
  //         Member: {
  //           model: "eternum-MapExplored",
  //           member: "timestamp",
  //           operator: "Gt",
  //           value: { U64: timestamp },
  //         },
  //       },
  //     ],
  //   },
  // };

  const eventSync = getSyncEvents(network.toriiClient, network.contractComponents as any, undefined, []);

  return {
    network,
    components,
    systemCalls,
    updates,
    sync,
    eventSync,
  };
}
