import { Component, Metadata, Schema } from "@dojoengine/recs";
import { setEntities } from "@dojoengine/state";
import { EntityKeysClause, createClient } from "@dojoengine/torii-wasm";

export async function setupWorker(
  config: { rpcUrl: string; toriiUrl: string; relayUrl: string; worldAddress: string },
  components: Component<Schema, Metadata, undefined>[],
  entityKeyClause: EntityKeysClause[],
  historical: boolean,
  logging = false,
) {
  if (logging) console.log("Starting syncEntities");

  const worker = new Worker(new URL("./entityWorker.js", import.meta.url), { type: "module" });

  // Create the client in the main thread
  const toriiClient = await createClient({
    rpcUrl: config.rpcUrl,
    toriiUrl: config.toriiUrl,
    relayUrl: config.relayUrl,
    worldAddress: config.worldAddress,
  });

  // Listen for batches from the Worker
  worker.onmessage = (event) => {
    const { updatedEntities } = event.data;
    setEntities(updatedEntities, components, logging);
  };

  // Set up subscriptions in the main thread
  await toriiClient.onEntityUpdated(entityKeyClause, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Main: Entity updated", fetchedEntities);
    // Send updates to worker for processing
    worker.postMessage({
      type: "update",
      entities: { fetchedEntities, data },
      logging,
    });
  });

  await toriiClient.onEventMessageUpdated(entityKeyClause, historical, (fetchedEntities: any, data: any) => {
    if (logging) console.log("Main: Event message updated", fetchedEntities);
    // Send updates to worker for processing
    worker.postMessage({
      type: "update",
      entities: { fetchedEntities, data },
      logging,
    });
  });

  return {
    cancel: () => {
      worker.terminate();
    },
  };
}
