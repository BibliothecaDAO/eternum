import { type GameSyncModelDefinition } from "@bibliothecadao/eternum/game-sync-models";
import { hash } from "starknet";
import { normalizeFelt, type ModelCodec, type ModelRegistry } from "../model-registry";
import type { DecodedWorldEvent, RawWorldEvent, RpcEvent } from "../types";
import type { WorldFold } from "../world-fold";
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
  private readonly schemas = new Map<string, NativeSchema>();
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
      this.schemas.set(identity, schema);
    }
    const active = this.requireSchema(release.activeSchema);
    if (Object.keys(release.domains).sort().join() !== Object.keys(active.domains).sort().join())
      throw new Error("Native domain set mismatch");
    for (const [domain, deployment] of Object.entries(release.domains)) {
      const address = normalizeFelt(deployment.address);
      if (BigInt(address) === 0n || this.emitters.has(address)) throw new Error("Duplicate or zero native emitter");
      this.emitters.set(address, domain);
      for (const identity of Object.values(deployment.classes)) this.requireSchema(identity);
      if (!deployment.classes[normalizeFelt(deployment.initialClassHash)])
        throw new Error("Missing initial native codec");
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
  decode(event: NativeRawEvent, fold: WorldFold): DecodedWorldEvent {
    const domain = this.emitters.get(normalizeFelt(event.from_address));
    if (!domain) throw new Error(`Foreign native emitter ${event.from_address}`);
    const schema = this.emitterSchema(domain, fold);
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
    if (model.name === "DomainClass") this.classSchema(domain, String(value.class_hash));
    return { ...base, kind: "set", key, value };
  }

  private emitterSchema(domain: string, fold: WorldFold): NativeSchema {
    const address = this.manifest.native.domains[domain].address;
    const current = fold
      .modelRows("DomainClass")
      .find((row) => BigInt(row.value.address as string) === BigInt(address));
    return this.classSchema(
      domain,
      current ? String(current.value.class_hash) : this.manifest.native.domains[domain].initialClassHash,
    );
  }
  private classSchema(domain: string, classHash: string): NativeSchema {
    const identity = this.manifest.native.domains[domain].classes[normalizeFelt(classHash)];
    if (!identity) throw new Error(`Unregistered native class ${classHash}`);
    return this.requireSchema(identity);
  }
  private requireSchema(identity: string): NativeSchema {
    const schema = this.schemas.get(identity);
    if (!schema) throw new Error(`Missing native schema ${identity}`);
    return schema;
  }
}

function definition(name: string, scope: "game" | "deployment"): GameSyncModelDefinition {
  return {
    name,
    channels: ["gamewide-entity"],
    availability: "all",
    s2Scope: scope === "game" ? "game" : "chain",
    recovery: "convergent-snapshot",
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
  if (BigInt(header[0] ?? -1) !== 1n) throw new Error("Unsupported native event version");
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
  const key = decodeMembers(schema, layout.members.filter((member) => member.kind === "key").slice(1), header.slice(1));
  if (BigInt(key.game_id as bigint) === 0n) throw new Error("Reserved native game id");
  const value = decodeMembers(
    schema,
    layout.members.filter((member) => member.kind === "data"),
    event.data,
  );
  return {
    kind: "event",
    model: {
      name: layout.name,
      channels: ["global-event"],
      availability: "all",
      s2Scope: "game",
      recovery: "event-deduped",
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
