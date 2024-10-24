import { DojoConfig } from "@dojoengine/core";
//import { getSyncEntities, getSyncEvents } from "@dojoengine/state";
import { createSystemCalls } from "./createSystemCalls";
import { setupNetwork } from "./setupNetwork";

export type SetupResult = Awaited<ReturnType<typeof setup>>;

export async function setup({ ...config }: DojoConfig) {
  const network = await setupNetwork(config);
  const systemCalls = createSystemCalls(network);


  return {
    network,
    systemCalls,
  };
}
