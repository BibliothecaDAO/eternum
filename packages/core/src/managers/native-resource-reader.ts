import type { ClientComponents } from "@bibliothecadao/types";
import { getComponentValue, HasValue, runQuery, type Component, type Schema } from "@dojoengine/recs";
import { gameEntityKey } from "./game-entity-keys";

type Production = {
  building_count: number;
  production_rate: bigint;
  output_amount_left: bigint;
  last_updated_at: number;
};

/** Sparse resource rows are zero only while their owning weight row exists. */
export function nativeResourceReader(components: ClientComponents, entityId: number) {
  const models = nativeResourceModels(components);
  if (!models) return undefined;
  const [balances, productions, weights] = models;
  const weight = getComponentValue(weights, gameEntityKey([BigInt(entityId)]));
  return {
    weight: weight ? { capacity: readInteger(weight.capacity), weight: readInteger(weight.weight) } : undefined,
    current(resourceId: number) {
      if (!Number.isInteger(resourceId) || resourceId < 1 || resourceId > 58)
        throw new Error(`Invalid resource ${resourceId}`);
      if (!weight) return undefined;
      const key = gameEntityKey([BigInt(entityId), BigInt(resourceId)]);
      const balance = getComponentValue(balances, key);
      const production = getComponentValue(productions, key);
      return {
        balance: balance ? readInteger(balance.balance) : 0n,
        production: production
          ? readProduction(production)
          : { building_count: 0, production_rate: 0n, output_amount_left: 0n, last_updated_at: 0 },
      };
    },
    producingResources() {
      if (!weight) return [];
      return [...runQuery([HasValue(productions, { game_id: weight.game_id, entity_id: entityId })])].map((key) =>
        readNumber(getComponentValue(productions, key)!.resource_type),
      );
    },
  };
}

export function nativeResourceModels(components: ClientComponents): Component<Schema>[] | undefined {
  const rows = components as unknown as Record<string, Component<Schema>>;
  if (!rows.ResourceWeight && !rows.ResourceBalance && !rows.ResourceProduction) return undefined;
  return ["ResourceBalance", "ResourceProduction", "ResourceWeight"].map((name) => {
    const model = rows[name];
    if (!model) throw new Error(`Missing native model ${name}`);
    return model;
  });
}

function readProduction(row: Record<string, unknown>): Production {
  return {
    building_count: readNumber(row.building_count),
    production_rate: readInteger(row.production_rate),
    output_amount_left: readInteger(row.output_amount_left),
    last_updated_at: readNumber(row.last_updated_at),
  };
}
function readInteger(value: unknown): bigint {
  if (typeof value !== "bigint") throw new Error("Invalid native resource integer");
  return value;
}
function readNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error("Invalid native resource number");
  return value;
}
