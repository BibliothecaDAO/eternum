import { CallData, type Abi } from "starknet";
import type { DecodedRecord } from "../types";
import { schemaAbi, type NativeMember, type NativeSchema } from "./schema";

const PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const ADDRESS_BOUND = (1n << 251n) - 256n;
const decoders = new WeakMap<NativeSchema, Map<string, CallData>>();

/** Check the complete wire frame before the ABI decoder can accept partial or trailing values. */
export function decodeMembers(schema: NativeSchema, members: NativeMember[], felts: string[]): DecodedRecord {
  const reader = new SerdeReader(schema, felts);
  members.forEach((member) => reader.read(member.type));
  reader.finish();
  return memberDecoder(schema, members).parse("row", felts) as DecodedRecord;
}

function memberDecoder(schema: NativeSchema, members: NativeMember[]): CallData {
  let layouts = decoders.get(schema);
  if (!layouts) {
    layouts = new Map();
    decoders.set(schema, layouts);
  }
  // Member updates construct new arrays; reuse the codec by layout, never by row values.
  const key = JSON.stringify(members.map(({ name, type }) => [name, type]));
  const existing = layouts.get(key);
  if (existing) return existing;
  const abi = [
    ...schemaAbi(schema),
    { type: "function", name: "row", inputs: [], outputs: members, state_mutability: "view" },
  ] as Abi;
  const decoder = new CallData(abi);
  layouts.set(key, decoder);
  return decoder;
}

class SerdeReader {
  private offset = 0;
  constructor(
    private readonly schema: NativeSchema,
    private readonly felts: string[],
  ) {}
  finish(): void {
    if (this.offset !== this.felts.length) throw new Error("Native row has trailing values");
  }
  read(type: string): void {
    if (type === "()") return;
    const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
    if (span) {
      const count = this.scalar();
      if (count > BigInt(this.felts.length - this.offset)) throw new Error("Native span exceeds frame");
      for (let index = 0n; index < count; index++) this.read(span[1]);
      return;
    }
    if (type.startsWith("(")) {
      tupleTypes(type).forEach((member) => this.read(member));
      return;
    }
    const definition = this.schema.types[type];
    if (definition?.type === "struct") {
      definition.members.forEach((member) => this.read(member.type));
      return;
    }
    if (definition?.type === "enum") {
      const variant = definition.variants[Number(this.scalar())];
      if (!variant) throw new Error(`Invalid native enum ${type}`);
      this.read(variant.type);
      return;
    }
    const value = this.scalar();
    const integer = /^core::integer::u(8|16|32|64|128)$/.exec(type);
    if (integer) {
      if (value >= 1n << BigInt(integer[1])) throw new Error(`Native integer exceeds ${type}`);
    } else if (type.endsWith("::ContractAddress")) {
      if (value >= ADDRESS_BOUND) throw new Error("Native address exceeds range");
    } else if (type !== "core::felt252" && !type.endsWith("::ClassHash"))
      throw new Error(`Unsupported native type ${type}`);
  }
  private scalar(): bigint {
    if (this.offset >= this.felts.length) throw new Error("Truncated native row");
    const value = BigInt(this.felts[this.offset++]);
    if (value < 0n || value >= PRIME) throw new Error("Native value is not a felt");
    return value;
  }
}

function tupleTypes(type: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let start = 1;
  for (let index = 1; index < type.length - 1; index++) {
    if (type[index] === "(" || type[index] === "<") depth++;
    if (type[index] === ")" || type[index] === ">") depth--;
    if (type[index] === "," && depth === 0) {
      members.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(type.slice(start, -1).trim());
  return members;
}
