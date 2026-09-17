import type { GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { CairoCustomEnum, CairoOption } from "starknet";
import type { DecodedRecord, Felt, ManifestModel } from "./types";

export interface ModelCodec {
  definition: GameSyncModelDefinition;
  manifest: ManifestModel;
  decodeKey: (felts: Felt[]) => DecodedRecord;
  decodeValue: (felts: Felt[]) => DecodedRecord;
  decodeMember: (selector: Felt, felts: Felt[]) => { member: string; value: unknown };
}

export interface ModelRegistry {
  nativeSchemaIdentity?: string;
  worldAddress: Felt;
  persistent: readonly ModelCodec[];
  events: readonly ModelCodec[];
  bySelector: ReadonlyMap<Felt, ModelCodec>;
}

export const normalizeFelt = (value: Felt): Felt => `0x${BigInt(value).toString(16)}`;

export const toJsonValue = (value: unknown): unknown => {
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (Array.isArray(value)) return value.map(toJsonValue);
  if (value instanceof CairoOption) return value.isSome() ? toJsonValue(value.unwrap()) : null;
  if (value instanceof CairoCustomEnum) {
    const variant = value.activeVariant();
    const payload = value.unwrap();
    const isUnit =
      payload === undefined ||
      (Array.isArray(payload) && payload.length === 0) ||
      (typeof payload === "object" && payload !== null && Object.keys(payload).length === 0);
    return isUnit ? variant : { [variant]: toJsonValue(payload) };
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toJsonValue(entry)]));
  }
  return value;
};
