import schemaJson from "../../../../contracts/l3/world-native/schema/schema.json";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { NativeWorldFold as WorldFold } from "./world-fold";
import type { RpcEvent, RpcReceipt } from "../types";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import type { NativeManifest, NativeSchema } from "./schema";
export const schema = schemaJson as unknown as NativeSchema;
export const manifest: NativeManifest = {
  world: { address: setFixture.deployment.season },
  native: {
    version: 1,
    deploymentBlock: 10,
    activeSchema: schema.identity,
    schemas: { [schema.identity]: schema },
    domains: Object.fromEntries(
      Object.entries(setFixture.deployment).map(([domain, address]) => [
        domain,
        { address, initialClassHash: "0x123", classes: { "0x123": schema.identity } },
      ]),
    ),
  },
};
export const receipt = (events: RpcEvent[], transaction_hash = "0x55"): RpcReceipt => ({
  transaction_hash,
  events,
  execution_status: "SUCCEEDED",
  finality_status: "ACCEPTED_ON_L2",
});
export const raw = (event: RpcEvent) => ({
  ...event,
  block_number: 10,
  transaction_hash: "0x55",
  transaction_index: 0,
  event_index: 0,
});
export const setup = () => {
  const decoder = new NativeDecoder(manifest);
  return { decoder, fold: new WorldFold(decoder.registry), native: new NativeIngestion(decoder) };
};
