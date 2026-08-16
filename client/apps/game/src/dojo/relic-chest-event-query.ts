import type { ID } from "@bibliothecadao/types";
import type { ToriiClient } from "@dojoengine/torii-client";
import type { Entity as ToriiEntity, PatternMatching, Query } from "@dojoengine/torii-wasm/types";
import { gameIdKey, gameModel, isGameScoped } from "./game-scope";

export interface OpenRelicChestEventValue {
  explorer_id: ID;
  chest_coord: { x: number; y: number };
  relics: Array<number | { value: number }>;
}

interface FetchOpenRelicChestEventInput {
  client: ToriiClient;
  explorerEntityId: ID;
  chestHex: { x: number; y: number };
}

const CHEST_EVENT_QUERY_TIMEOUT_MS = 8_000;

const toU32Key = (value: number): string => `0x${BigInt.asUintN(32, BigInt(value)).toString(16)}`;

export const buildOpenRelicChestEventQuery = (explorerEntityId: ID, chestHex: { x: number; y: number }): Query => {
  const model = gameModel("OpenRelicChestEvent");
  const eventKeys = [toU32Key(Number(explorerEntityId)), "0x0", toU32Key(chestHex.x), toU32Key(chestHex.y)];

  return {
    pagination: { limit: 1, cursor: undefined, direction: "Backward", order_by: [] },
    clause: {
      Keys: {
        keys: isGameScoped() ? [gameIdKey(), ...eventKeys] : eventKeys,
        pattern_matching: "VariableLen" as PatternMatching,
        models: [model],
      },
    },
    no_hashed_keys: false,
    models: [model],
    historical: false,
  };
};

const readOpenRelicChestEvent = (entity: ToriiEntity | undefined): OpenRelicChestEventValue | null => {
  const value = entity?.models?.[gameModel("OpenRelicChestEvent")];
  return value && typeof value === "object" ? (value as unknown as OpenRelicChestEventValue) : null;
};

export async function fetchOpenRelicChestEvent({
  client,
  explorerEntityId,
  chestHex,
}: FetchOpenRelicChestEventInput): Promise<OpenRelicChestEventValue | null> {
  const query = client.getEventMessages(buildOpenRelicChestEventQuery(explorerEntityId, chestHex));
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const page = await Promise.race([
      query,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("Timed out loading the chest result.")),
          CHEST_EVENT_QUERY_TIMEOUT_MS,
        );
      }),
    ]);
    return readOpenRelicChestEvent(page.items[0]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const decodeOpenRelicChestRelics = (event: OpenRelicChestEventValue): number[] =>
  event.relics.map((relic) => (typeof relic === "number" ? relic : relic.value));
