import { readFile } from "node:fs/promises";

import { GAME_SYNC_MODEL_MANIFEST, type GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { CallData, CairoCustomEnum, CairoOption, hash, type Abi } from "starknet";

import type { DecodedRecord, Felt, ManifestMember, ManifestModel, StructAbiEntry, WorldManifest } from "./types";
import { StoreLayout } from "./store-layout";

interface MemberDecoder {
  member: ManifestMember;
  functionName: string;
}

interface PreparedModelCodec {
  definition: GameSyncModelDefinition;
  keyFunction: string;
  keyMembers: ManifestMember[];
  manifest: ManifestModel;
  memberDecoders: Map<Felt, MemberDecoder>;
  valueFunction: string;
  valueMembers: ManifestMember[];
}

export interface ModelCodec {
  definition: GameSyncModelDefinition;
  manifest: ManifestModel;
  decodeKey: (felts: Felt[]) => DecodedRecord;
  decodeValue: (felts: Felt[]) => DecodedRecord;
  decodeMember: (selector: Felt, felts: Felt[]) => { member: string; value: unknown };
}

export interface ModelRegistry {
  worldAddress: Felt;
  persistent: readonly ModelCodec[];
  events: readonly ModelCodec[];
  bySelector: ReadonlyMap<Felt, ModelCodec>;
}

const isStructAbiEntry = (entry: WorldManifest["abis"][number]): entry is StructAbiEntry => entry.type === "struct";

const modelNameFromTag = (tag: string): string => {
  const separator = tag.indexOf("-");
  if (separator < 0 || separator === tag.length - 1) {
    throw new Error(`Manifest tag ${tag} has no namespace separator`);
  }
  return tag.slice(separator + 1);
};

const hasMatchingMembers = (entry: StructAbiEntry, members: readonly ManifestMember[]): boolean =>
  entry.members.length === members.length &&
  entry.members.every((member, index) => member.name === members[index].name && member.type === members[index].type);

const resolveModelStruct = (manifest: WorldManifest, model: ManifestModel): StructAbiEntry => {
  const matches = manifest.abis.filter(isStructAbiEntry).filter((entry) => hasMatchingMembers(entry, model.members));
  if (matches.length !== 1) {
    throw new Error(`Manifest model ${model.tag} matched ${matches.length} ABI structs; expected exactly one`);
  }
  return matches[0];
};

const decodeRecord = (callData: CallData, functionName: string, felts: Felt[]): DecodedRecord => {
  const decoded = callData.parse(functionName, felts);
  if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
    throw new Error(`Decoder ${functionName} did not return a record`);
  }
  return decoded as DecodedRecord;
};

const prepareModelCodec = (
  manifest: WorldManifest,
  model: ManifestModel,
  definition: GameSyncModelDefinition,
): PreparedModelCodec => {
  resolveModelStruct(manifest, model);
  const keyMembers = model.members.filter(({ key }) => key);
  const valueMembers = model.members.filter(({ key }) => !key);
  const functionPrefix = `herald_${model.selector.slice(2)}`;
  const keyFunction = `${functionPrefix}_key`;
  const valueFunction = `${functionPrefix}_value`;
  const memberDecoders = new Map<Felt, MemberDecoder>(
    valueMembers.map((member, index) => [
      normalizeFelt(hash.getSelectorFromName(member.name)),
      { member, functionName: `${functionPrefix}_member_${index}` },
    ]),
  );
  return { definition, keyFunction, keyMembers, manifest: model, memberDecoders, valueFunction, valueMembers };
};

const decoderFunctions = ({
  keyFunction,
  keyMembers,
  memberDecoders,
  valueFunction,
  valueMembers,
}: PreparedModelCodec): Abi =>
  [
    { type: "function", name: keyFunction, inputs: [], outputs: keyMembers, state_mutability: "view" },
    { type: "function", name: valueFunction, inputs: [], outputs: valueMembers, state_mutability: "view" },
    ...[...memberDecoders.values()].map(({ member, functionName }) => ({
      type: "function",
      name: functionName,
      inputs: [],
      outputs: [member],
      state_mutability: "view",
    })),
  ] as Abi;

const buildModelCodec = (model: PreparedModelCodec, callData: CallData, storeLayout: StoreLayout): ModelCodec => {
  const { definition, keyFunction, keyMembers, manifest, memberDecoders, valueFunction, valueMembers } = model;

  return {
    definition,
    manifest,
    decodeKey: (felts) =>
      keyMembers.length === 0
        ? {}
        : decodeRecord(callData, keyFunction, storeLayout.normalizeMembers(keyMembers, felts)),
    decodeValue: (felts) =>
      valueMembers.length === 0
        ? {}
        : decodeRecord(callData, valueFunction, storeLayout.normalizeMembers(valueMembers, felts)),
    decodeMember: (selector, felts) => {
      const decoder = memberDecoders.get(normalizeFelt(selector));
      if (!decoder) {
        throw new Error(`Model ${definition.name} has no member for selector ${selector}`);
      }
      const decoded = decodeRecord(
        callData,
        decoder.functionName,
        storeLayout.normalizeMembers([decoder.member], felts),
      );
      return { member: decoder.member.name, value: decoded[decoder.member.name] };
    },
  };
};

const resolveManifestModel = (manifest: WorldManifest, definition: GameSyncModelDefinition): ManifestModel => {
  const expectedCollection = definition.channels.includes("global-event") ? manifest.events : manifest.models;
  const unexpectedCollection = definition.channels.includes("global-event") ? manifest.models : manifest.events;
  const expected = expectedCollection.filter((model) => modelNameFromTag(model.tag) === definition.name);
  const unexpected = unexpectedCollection.filter((model) => modelNameFromTag(model.tag) === definition.name);

  if (expected.length !== 1 || unexpected.length !== 0) {
    throw new Error(
      `Sync model ${definition.name} has ${expected.length} matching definitions in its expected manifest collection and ${unexpected.length} in the other collection`,
    );
  }
  return expected[0];
};

export const createModelRegistry = (
  manifest: WorldManifest,
  definitions: readonly GameSyncModelDefinition[] = GAME_SYNC_MODEL_MANIFEST,
): ModelRegistry => {
  const prepared = definitions.map((definition) =>
    prepareModelCodec(manifest, resolveManifestModel(manifest, definition), definition),
  );
  const callData = new CallData([...manifest.abis, ...prepared.flatMap(decoderFunctions)] as Abi);
  const storeLayout = new StoreLayout(manifest.abis);
  const codecs = prepared.map((model) => buildModelCodec(model, callData, storeLayout));
  const bySelector = new Map(codecs.map((codec) => [normalizeFelt(codec.manifest.selector), codec]));
  if (bySelector.size !== codecs.length) {
    throw new Error("Two sync models share a manifest selector");
  }

  return {
    worldAddress: normalizeFelt(manifest.world.address),
    persistent: codecs.filter(({ definition }) => definition.channels.includes("gamewide-entity")),
    events: codecs.filter(({ definition }) => definition.channels.includes("global-event")),
    bySelector,
  };
};

export const readWorldManifest = async (path: string): Promise<WorldManifest> => {
  let manifest: WorldManifest;
  try {
    manifest = JSON.parse(await readFile(path, "utf8")) as WorldManifest;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read world manifest ${path}: ${message}`);
  }
  if (!manifest.world?.address || !Array.isArray(manifest.models) || !Array.isArray(manifest.events)) {
    throw new Error(`World manifest is incomplete: ${path}`);
  }
  return manifest;
};

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
