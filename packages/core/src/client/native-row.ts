import {
  nativeFactModels,
  type NativeModelName,
  type NativeRows,
} from "../../../../contracts/l3/world-native/schema/client.gen";

export interface DeclaredAbsence {
  value: string;
  parent?: NativeModelName;
  parentKeys?: Readonly<Record<string, string>>;
}

export type WireType = string | readonly [WireType] | { readonly [field: string]: WireType | readonly string[] };
type Decoder = (value: unknown) => unknown;

export const nativeRowDefinitions = nativeFactModels as Record<
  NativeModelName,
  {
    keys: readonly string[];
    scope: "game" | "deployment";
    fields: Record<string, WireType>;
    absence?: DeclaredAbsence;
  }
>;
/**
 * The contract allocates every entity id at or under 2^53 - 1, so a JavaScript number holds each one exactly. The
 * schema keeps ids as plain u64, so they are known by name: every u64 *_id, and the three fields naming an entity
 * without the suffix (a labor grant's home, an army's owning structure, a village's realm).
 */
const MAX_ENTITY_ID = BigInt(Number.MAX_SAFE_INTEGER);
const isEntityIdField = (path: string): boolean => {
  const field = path.slice(path.lastIndexOf(".") + 1);
  return field.endsWith("_id") || field === "home" || field === "owner" || field === "village_realm";
};

const decoders = new Map<NativeModelName, Decoder>(
  Object.entries(nativeRowDefinitions).map(([name, definition]) => [
    name as NativeModelName,
    compileDecoder(definition.fields, name),
  ]),
);

/** Validate the complete Herald wire row against the generated native schema before exposing its typed fields. */
export function decodeNativeRow<M extends NativeModelName>(model: M, value: unknown): NativeRows[M] {
  const row = decoders.get(model)!(value) as NativeRows[M];
  if (nativeRowDefinitions[model].scope === "game" && (!("game_id" in row) || row.game_id === 0))
    throw new Error(`Reserved game id in ${model}`);
  return row;
}

export function integer(value: unknown, limit: bigint, path: string): bigint {
  if (typeof value === "number" && !Number.isSafeInteger(value)) throw new Error(`Unsafe integer in ${path}`);
  if (
    typeof value !== "number" &&
    typeof value !== "bigint" &&
    !(typeof value === "string" && /^(0x[0-9a-fA-F]+|[0-9]+)$/.test(value))
  )
    throw new Error(`Invalid integer in ${path}`);
  const result = BigInt(value);
  if (result < 0n || result >= limit) throw new Error(`Integer out of range in ${path}`);
  return result;
}

export function compileDecoder(type: WireType, path: string): Decoder {
  if (type === "boolean")
    return (value) => {
      if (typeof value !== "boolean") throw new Error(`Invalid boolean in ${path}`);
      return value;
    };
  if (typeof type === "string") {
    const bits = Number(type.slice(1));
    if (type === "u64" && isEntityIdField(path))
      return (value) => {
        const result = integer(value, 1n << 64n, path);
        if (result > MAX_ENTITY_ID) throw new Error(`Entity id out of range in ${path}`);
        return result;
      };
    const limit = type === "felt" ? (1n << 251n) + 17n * (1n << 192n) + 1n : 1n << BigInt(bits);
    return (value) => {
      const result = integer(value, limit, path);
      return type !== "felt" && bits <= 32 ? Number(result) : result;
    };
  }
  if (Array.isArray(type)) {
    const item = compileDecoder(type[0], `${path}[]`);
    return (value) => {
      if (!Array.isArray(value)) throw new Error(`Invalid array in ${path}`);
      return Object.freeze(value.map(item));
    };
  }
  if ("option" in type) {
    const item = compileDecoder(type.option as WireType, path);
    return (value) => (value === null ? null : item(value));
  }
  if ("enum" in type)
    return (value) => {
      if (typeof value !== "string" || !(type.enum as readonly string[]).includes(value))
        throw new Error(`Invalid enum in ${path}`);
      return value;
    };
  if ("variants" in type) {
    const variants = new Map(
      Object.entries(type.variants).map(([name, payload]) => [
        name,
        compileDecoder(payload as WireType, `${path}.${name}`),
      ]),
    );
    return (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== 1)
        throw new Error(`Invalid enum in ${path}`);
      const [name, payload] = Object.entries(value)[0]!;
      const decode = variants.get(name);
      if (!decode) throw new Error(`Invalid enum in ${path}`);
      return Object.freeze({ [name]: decode(payload) });
    };
  }
  const fields = Object.entries(type).map(
    ([field, definition]) => [field, compileDecoder(definition as WireType, `${path}.${field}`)] as const,
  );
  return (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid row in ${path}`);
    const row = value as Record<string, unknown>;
    if (Object.keys(row).length !== fields.length) throw new Error(`Unexpected fields in ${path}`);
    return Object.freeze(Object.fromEntries(fields.map(([name, decode]) => [name, decode(row[name])])));
  };
}
