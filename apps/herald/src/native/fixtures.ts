import schemaJson from "../../../../contracts/l3/world-native/schema/schema.json";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { WorldFold } from "../world-fold";
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

export function rowEvent(name: string, keys: string[], values: string[]): RpcEvent {
  const model = schema.models.find((model) => model.name === name)!;
  const domain = model.owners[0];
  const layout = schema.domains[domain].events.find((event) => event.name === "RowSet")!;
  return {
    from_address: manifest.native.domains[domain].address,
    keys: [...layout.prefix, "1", model.identity],
    data: [String(keys.length), ...keys, String(values.length), ...values],
  };
}

export function rulesEvent(gameId = "1") {
  const model = schema.models.find((model) => model.name === "SliceRules")!;
  const defaults = (type: string): string[] => {
    const definition = schema.types[type];
    if (definition?.type === "struct") return definition.members.flatMap(({ type }) => defaults(type));
    if (definition?.type === "enum") return ["0", ...defaults(definition.variants[0].type)];
    if (type === "()") return [];
    return ["0"];
  };
  const values = model.members.flatMap((member) => {
    if (member.name === "mode_id") return ["1"];
    if (member.name === "victory_points_grant_config") {
      const definition = schema.types[member.type];
      if (definition.type !== "struct") throw new Error("Expected point rules");
      return definition.members.flatMap((field) =>
        field.name === "hyp_points_per_second" ? ["1000000"] : defaults(field.type),
      );
    }
    return defaults(member.type);
  });
  return rowEvent("SliceRules", [gameId], values);
}

export function battleEvent(attacker = "7", defender = "8", timestamp = "1920"): RpcEvent {
  const layout = schema.domains.troops.events.find((event) => event.name === "BattleEvent")!;
  return {
    from_address: manifest.native.domains.troops.address,
    keys: [...layout.prefix, "1", "1", attacker, defender, "2", "3"],
    data: [
      attacker,
      "0",
      "12",
      "34",
      "0",
      "0x111",
      "0",
      "0",
      "100",
      "90",
      "5",
      "0x222",
      "1",
      "1",
      "80",
      "0",
      "4",
      timestamp,
    ],
  };
}
