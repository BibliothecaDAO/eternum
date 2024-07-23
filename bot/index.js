import { createClient } from "@dojoengine/torii-client";

export const toriiClient = await createClient([], {
  rpcUrl: dojoConfig.rpcUrl,
  toriiUrl: dojoConfig.toriiUrl,
  relayUrl: "",
  worldAddress: dojoConfig.manifest.world.address || "",
});
