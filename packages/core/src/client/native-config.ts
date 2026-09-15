import { getComponentValue, type Component, type Schema } from "@dojoengine/recs";
import type { ContractComponents } from "@bibliothecadao/types";
import { getEntityIdFromKeys } from "../managers/game-entity-keys";

export interface NativeConfiguration {
  rules(): Record<string, unknown>;
  world(): Record<string, unknown>;
  weight(resource: number): number;
}

export function nativeConfiguration(components: ContractComponents, gameId: number): NativeConfiguration {
  const read = (name: string, keys: bigint[]) => {
    const value = readNativeRow(components, name, keys);
    if (!value) throw new Error(`Native ${name} is not synchronized`);
    return requiredMembers(value, name);
  };
  const rules = () => read("SliceRules", [BigInt(gameId)]);
  return {
    rules,
    world: () =>
      requiredMembers(
        {
          game_id: gameId,
          map_center_offset: rules().map_center_offset,
          season_mode_on: !rules().blitz_mode_on,
          blitz_mode_on: rules().blitz_mode_on,
        },
        "native world",
      ),
    weight: (resource) => Number(read("ResourceRule", [BigInt(gameId), BigInt(resource)]).unit_weight) / 1_000,
  };
}

/** An unported configuration member must not fall through a legacy balance default. */
function requiredMembers(value: Record<string, unknown>, model: string): Record<string, unknown> {
  return new Proxy(value, {
    get(target, key) {
      if (typeof key === "string" && !Object.hasOwn(target, key))
        throw new Error(`Unsupported native configuration ${model}.${key}`);
      return Reflect.get(target, key);
    },
  });
}

export function readNativeRow(
  components: ContractComponents,
  name: string,
  keys: bigint[],
): Record<string, unknown> | undefined {
  const component = (components as unknown as Record<string, Component<Schema>>)[name];
  if (!component) throw new Error(`Missing native component ${name}`);
  return getComponentValue(component, getEntityIdFromKeys(keys));
}
