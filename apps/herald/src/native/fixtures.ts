import schemaJson from "../../../../contracts/l3/world-native/schema/schema.json";
import setFixture from "../../../../contracts/l3/world-native/schema/fixtures/row-set.json";
import { WorldFold } from "../world-fold";
import type { DecodedRecord, RpcEvent, RpcReceipt } from "../types";
import type { NativeRows } from "../../../../contracts/l3/world-native/schema/client.gen";
import { decodeMembers, encodeMembers } from "./serde";
import { CairoCustomEnum } from "starknet";
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
    migrationClassHash: "0x0",
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

export function rowEvent(name: string, keys: string[], values: DecodedRecord): RpcEvent {
  const model = schema.models.find((model) => model.name === name)!;
  const layout = schema.games.events.find((event) => event.name === "RowSet")!;
  const felts = encodeMembers(schema, model.members, values);
  return {
    from_address: manifest.world.address,
    keys: [...layout.prefix, "1", model.identity],
    data: [String(keys.length), ...keys, String(felts.length), ...felts],
  };
}

/** Named synthetic values: encoding always follows the current schema. */
export const structureValue = {
  owner: 0n,
  base: {
    troop_max_guard_count: 0,
    troop_max_explorer_count: 0,
    created_at: 0,
    category: 0,
    level: 0,
    starting_troops_granted: false,
  },
  resources_packed: 0n,
  metadata: {
    realm_id: 0,
    order: 0,
    has_wonder: false,
    village_realm: 0,
    mine_kind: 0,
    deepest_depth: 0,
  },
} satisfies Omit<NativeRows["Structure"], "game_id" | "entity_id">;

export function explorerValue(owner: string, count = 0n, amount = 0n, updatedTick = 0n): DecodedRecord {
  return {
    owner,
    troops: {
      category: new CairoCustomEnum({ Knight: {} }),
      tier: new CairoCustomEnum({ T1: {} }),
      count,
      stamina: new CairoCustomEnum({ Inline: { amount, updated_tick: updatedTick } }),
      boosts: {
        incr_damage_dealt_percent_num: 0,
        incr_damage_dealt_end_tick: 0,
        decr_damage_gotten_percent_num: 0,
        decr_damage_gotten_end_tick: 0,
        incr_stamina_regen_percent_num: 0,
        incr_stamina_regen_tick_count: 0,
        incr_explore_reward_percent_num: 0,
        incr_explore_reward_end_tick: 0,
      },
      battle_cooldown_end: 0,
    },
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

/** Unit-test projections enter the fold directly; they are never accepted as chain row events. */
export function seedDerivedRows(fold: WorldFold, decoder: NativeDecoder, events: RpcEvent[]): RpcEvent[] {
  return events.filter((event) => {
    const model = schema.models.find(
      (model) =>
        model.derivedFrom &&
        BigInt(model.identity) ===
          BigInt(event.keys[schema.games.events.find(({ name }) => name === "RowSet")!.prefix.length + 1] ?? 0),
    );
    if (!model) return true;
    const count = Number(event.data[0]);
    fold.apply(decoder.decodeRowSet(model.name, event.data.slice(1, count + 1), event.data.slice(count + 2)));
    return false;
  });
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
  return rowEvent("SliceRules", [gameId], decodeMembers(schema, model.members, values));
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
