import schemaJson from "../../../../contracts/l3/world-native/schema/schema.json";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { WorldFold } from "../world-fold";
import type { RpcEvent, RpcReceipt } from "../types";
import { NativeDecoder } from "./decoder";
import { NativeIngestion } from "./ingestion";
import type { NativeManifest, NativeSchema } from "./schema";
import { buildShardManifest } from "../shard-manifest";
export const schema = schemaJson as unknown as NativeSchema;
export const manifest: NativeManifest = {
  world: { address: setFixture.deployment.games },
  native: {
    version: 2,
    deploymentBlock: 10,
    activeSchema: schema.identity,
    releaseSchemas: { "1": schema.identity },
    schemas: { [schema.identity]: schema },
    gamesClassHash: "0x123",
    releaseId: 1,
    logic: Object.fromEntries(Object.keys(schema.logicClasses).map((name) => [name, "0x123"])),
  },
};
export const shardManifest = buildShardManifest(
  { ...manifest, shard: { chainId: "0x4c4142", accountClassHash: "0x456", contracts: {}, guardianPublicKey: "0xabc" } },
  { rpcUrl: "https://rpc.shard.test", admissionUrl: "https://admission.shard.test" },
);
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
  const layout = schema.games.events.find((event) => event.name === "RowSet")!;
  return {
    from_address: manifest.world.address,
    keys: [...layout.prefix, "1", model.identity],
    data: [String(keys.length), ...keys, String(values.length), ...values],
  };
}

export function pointsAward(
  game: string,
  player: string,
  amount: string,
  playerPoints: string,
  seasonPoints: string,
): RpcEvent {
  const layout = schema.games.events.find((event) => event.name === "PointsAwarded")!;
  return {
    from_address: manifest.world.address,
    keys: [...layout.prefix, "1", game, player],
    data: ["4", amount, playerPoints, seasonPoints],
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

export function battleEvent(attacker = "7", defender = "8", timestamp = "1920", order = "42", index = "0"): RpcEvent {
  const layout = schema.games.events.find((event) => event.name === "BattleEvent")!;
  return {
    from_address: manifest.world.address,
    keys: [...layout.prefix, "1", "1", order, index, attacker, defender, "2", "3"],
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
