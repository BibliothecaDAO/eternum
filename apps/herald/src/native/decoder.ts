import { type GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { hash } from "starknet";
import { normalizeFelt, type ModelCodec, type ModelRegistry } from "../model-registry";
import type { DecodedWorldEvent, RawWorldEvent, RpcEvent } from "../types";
import { decodeMembers } from "./serde";
import {
  schemaIdentity,
  type NativeEventLayout,
  type NativeManifest,
  type NativeModel,
  type NativeSchema,
} from "./schema";

export type NativeRawEvent = RawWorldEvent & RpcEvent;

export class NativeDecoder {
  readonly registry: ModelRegistry;
  private readonly emitters = new Map<string, string>();
  private readonly schema: NativeSchema;
  constructor(readonly manifest: NativeManifest) {
    const release = manifest.native;
    if (release.version !== 1 || !Number.isSafeInteger(release.deploymentBlock) || release.deploymentBlock < 0)
      throw new Error("Invalid native release");
    for (const [identity, schema] of Object.entries(release.schemas)) {
      if (
        schema.version !== 2 ||
        schema.encoding !== "cairo-serde" ||
        identity !== schema.identity ||
        schemaIdentity(schema) !== identity
      )
        throw new Error("Native schema identity mismatch");
    }
    const active = release.schemas[release.activeSchema];
    if (!active) throw new Error(`Missing native schema ${release.activeSchema}`);
    this.schema = active;
    if (Object.keys(release.domains).sort().join() !== Object.keys(active.domains).sort().join())
      throw new Error("Native domain set mismatch");
    for (const [domain, deployment] of Object.entries(release.domains)) {
      const address = normalizeFelt(deployment.address);
      if (BigInt(address) === 0n || this.emitters.has(address)) throw new Error("Duplicate or zero native emitter");
      this.emitters.set(address, domain);
    }
    if (BigInt(manifest.world.address) !== BigInt(release.domains.season.address))
      throw new Error("Native deployment identity is not its season domain");
    const codecs = active.models.map((model) => modelCodec(active, model));
    this.registry = {
      nativeSchemaIdentity: release.activeSchema,
      worldAddress: normalizeFelt(manifest.world.address),
      persistent: codecs,
      events: [],
      bySelector: new Map(codecs.map((codec) => [codec.manifest.selector, codec])),
    };
  }
  owns(address: string): boolean {
    return this.emitters.has(normalizeFelt(address));
  }
  decode(event: NativeRawEvent): DecodedWorldEvent {
    const domain = this.emitters.get(normalizeFelt(event.from_address));
    if (!domain) throw new Error(`Foreign native emitter ${event.from_address}`);
    const schema = this.schema;
    const layout = schema.domains[domain].events.find((candidate) =>
      candidate.prefix.every((key, index) => BigInt(key) === BigInt(event.keys[index] ?? -1)),
    );
    if (!layout) throw new Error("Unknown native event prefix");
    return schema.events.some((projection) => projection.name === layout.name)
      ? decodeEvent(event, domain, schema, layout)
      : this.decodeRow(event, domain, schema, layout);
  }
  private decodeRow(
    event: NativeRawEvent,
    domain: string,
    schema: NativeSchema,
    layout: NativeEventLayout,
  ): DecodedWorldEvent {
    const header = event.keys.slice(layout.prefix.length);
    if (BigInt(header[0] ?? -1) !== 1n) throw new Error("Unsupported native event version");
    const position = {
      blockNumber: event.block_number,
      transactionHash: normalizeFelt(event.transaction_hash),
      transactionIndex: event.transaction_index,
      eventIndex: event.event_index,
    };

    const model = schema.models.find((model) => BigInt(model.identity) === BigInt(header[1] ?? -1));
    if (!model || !model.owners.includes(domain)) throw new Error("Native model emitted by wrong domain");
    const memberEvent = layout.name === "RowMemberSet";
    if (header.length !== (memberEvent ? 3 : 2)) throw new Error("Malformed native event header");
    const frame = readFrame(event.data, layout.name !== "RowDeleted");
    const key = decodeMembers(schema, model.keys, frame.keys);
    if (model.scope === "game" && BigInt(key.game_id as bigint) === 0n) throw new Error("Reserved native game id");
    if (model.emitterKey && BigInt(key[model.emitterKey] as bigint) !== BigInt(event.from_address))
      throw new Error("Native row names a foreign emitter");
    const base = {
      model: definition(model.name, model.scope),
      entityId: normalizeFelt(hash.computePoseidonHashOnElements(frame.keys)),
      key,
      position,
    };
    if (layout.name === "RowDeleted") return { ...base, kind: "delete" };
    if (memberEvent) {
      const member = model.members.find((member) => BigInt(member.id!) === BigInt(header[2]));
      if (!member) throw new Error("Unknown native member");
      const value = decodeMembers(schema, [member], frame.values);
      return { ...base, kind: "update-member", member: member.name, value: value[member.name] };
    }
    const value = decodeMembers(schema, model.members, frame.values);
    return { ...base, kind: "set", value };
  }
}

function definition(name: string, scope: "game" | "deployment"): GameSyncModelDefinition {
  return {
    name,
    scope,
    deletion: "component",
  };
}
function modelCodec(schema: NativeSchema, model: NativeModel): ModelCodec {
  return {
    definition: definition(model.name, model.scope),
    manifest: {
      tag: `native-${model.name}`,
      selector: normalizeFelt(model.identity),
      members: [
        ...model.keys.map((member) => ({ ...member, key: true })),
        ...model.members.map((member) => ({ ...member, key: false })),
      ],
    },
    decodeKey: (values) => decodeMembers(schema, model.keys, values),
    decodeValue: (values) => decodeMembers(schema, model.members, values),
    decodeMember: (id, values) => {
      const member = model.members.find((member) => BigInt(member.id!) === BigInt(id));
      if (!member) throw new Error("Unknown native member");
      return { member: member.name, value: decodeMembers(schema, [member], values)[member.name] };
    },
  };
}
function readFrame(data: string[], withValue: boolean): { keys: string[]; values: string[] } {
  let offset = 0;
  const span = () => {
    const length = Number(BigInt(data[offset++] ?? -1));
    if (!Number.isSafeInteger(length) || length < 0 || length > data.length - offset)
      throw new Error("Malformed native row span");
    const values = data.slice(offset, offset + length);
    offset += length;
    return values;
  };
  const keys = span();
  const values = withValue ? span() : [];
  if (offset !== data.length) throw new Error("Native row has trailing data");
  return { keys, values };
}

function decodeEvent(
  event: NativeRawEvent,
  domain: string,
  schema: NativeSchema,
  layout: NativeEventLayout,
): DecodedWorldEvent {
  const header = event.keys.slice(layout.prefix.length);
  const keyMembers = layout.members.filter((member) => member.kind === "key");
  const versioned = keyMembers[0]?.name === "version";
  if (versioned && BigInt(header[0] ?? -1) !== 1n) throw new Error("Unsupported native event version");
  const position = {
    blockNumber: event.block_number,
    transactionHash: normalizeFelt(event.transaction_hash),
    transactionIndex: event.transaction_index,
    eventIndex: event.event_index,
  };
  const projection = schema.events.find(
    (projection) => projection.name === layout.name && projection.owners.includes(domain),
  );
  if (!projection) throw new Error("Unowned native event");
  const key = decodeMembers(schema, versioned ? keyMembers.slice(1) : keyMembers, versioned ? header.slice(1) : header);
  if (projection.scope === "game" && BigInt(key.game_id as bigint) === 0n) throw new Error("Reserved native game id");
  const value = decodeMembers(
    schema,
    layout.members.filter((member) => member.kind === "data"),
    event.data,
  );
  return {
    kind: "event",
    model: {
      name: layout.name,
      scope: projection.scope,
      deletion: "event-ephemeral",
    },
    entityId: normalizeFelt(hash.computePoseidonHashOnElements([position.transactionHash, position.eventIndex])),
    position,
    key,
    value: {
      ...value,
      event_position: { transaction_hash: position.transactionHash, event_index: position.eventIndex },
    },
  };
}
