import schemaRegistry from "../schema/schema-registry-v1.json";

type FeltInput = bigint | number | string;
export type SchemaValue = FeltInput | boolean | readonly SchemaValue[] | { readonly [key: string]: SchemaValue };

interface SchemaMember {
  name: string;
  type: string | null;
}

interface SchemaDeclaration {
  kind: "type" | "struct" | "enum" | "trait";
  name: string;
  alias?: string;
  members?: readonly (SchemaMember | string)[];
}

interface DecodedValue {
  value: unknown;
  nextOffset: number;
}

const FELT_PRIME = (1n << 251n) + 17n * (1n << 192n) + 1n;
const DECLARATIONS = new Map(
  (schemaRegistry.declarations as readonly SchemaDeclaration[]).map((declaration) => [declaration.name, declaration]),
);

export function encodeSchema(schemaName: string, value: SchemaValue): bigint[] {
  return encodeType(schemaName, value);
}

export function encodeFlatSchema(schemaName: string, value: object): bigint[] {
  const record: Record<string, SchemaValue> = {};
  for (const [field, fieldValue] of Object.entries(value)) {
    if (
      typeof fieldValue !== "bigint" &&
      typeof fieldValue !== "number" &&
      typeof fieldValue !== "string" &&
      typeof fieldValue !== "boolean"
    ) {
      throw new Error(`${schemaName}.${field} is not a flat schema value`);
    }
    record[field] = fieldValue;
  }
  return encodeSchema(schemaName, record);
}

export function decodeSchema(schemaName: string, felts: readonly FeltInput[]): unknown {
  const canonicalFelts = felts.map((felt) => canonicalFelt(felt));
  const decoded = decodeType(schemaName, canonicalFelts, 0);
  if (decoded.nextOffset !== canonicalFelts.length) {
    throw new Error(`trailing felts for ${schemaName}`);
  }
  return decoded.value;
}

function encodeType(type: string, value: SchemaValue): bigint[] {
  const normalizedType = type.trim();
  if (normalizedType === "bool") return [encodeBoolean(value)];
  if (normalizedType === "u256") return encodeU256(value);
  if (isSingleFeltType(normalizedType)) return [encodeBoundedFelt(normalizedType, value)];
  if (isVectorType(normalizedType)) return encodeVector(normalizedType, value);
  if (isTupleType(normalizedType)) return encodeTuple(normalizedType, value);

  const declaration = resolveDeclaration(normalizedType);
  if (declaration.kind === "type") return encodeType(requiredAlias(declaration), value);
  if (declaration.kind === "struct") return encodeStruct(declaration, value);
  if (declaration.kind === "enum") return encodeEnum(declaration, value);
  throw new Error(`interfaces are not serializable: ${normalizedType}`);
}

function decodeType(type: string, felts: readonly bigint[], offset: number): DecodedValue {
  const normalizedType = type.trim();
  if (normalizedType === "bool") return decodeBoolean(felts, offset);
  if (normalizedType === "u256") return decodeU256(felts, offset);
  if (isSingleFeltType(normalizedType)) return decodeBoundedFelt(normalizedType, felts, offset);
  if (isVectorType(normalizedType)) return decodeVector(normalizedType, felts, offset);
  if (isTupleType(normalizedType)) return decodeTuple(normalizedType, felts, offset);

  const declaration = resolveDeclaration(normalizedType);
  if (declaration.kind === "type") return decodeType(requiredAlias(declaration), felts, offset);
  if (declaration.kind === "struct") return decodeStruct(declaration, felts, offset);
  if (declaration.kind === "enum") return decodeEnum(declaration, felts, offset);
  throw new Error(`interfaces are not serializable: ${normalizedType}`);
}

function encodeStruct(declaration: SchemaDeclaration, value: SchemaValue): bigint[] {
  const record = requireRecord(declaration.name, value);
  const members = dataMembers(declaration);
  assertExactFields(declaration.name, record, members);
  return members.flatMap((member) => encodeType(requiredMemberType(declaration.name, member), record[member.name]));
}

function decodeStruct(declaration: SchemaDeclaration, felts: readonly bigint[], offset: number): DecodedValue {
  const value: Record<string, unknown> = {};
  let nextOffset = offset;
  for (const member of dataMembers(declaration)) {
    const decoded = decodeType(requiredMemberType(declaration.name, member), felts, nextOffset);
    value[member.name] = decoded.value;
    nextOffset = decoded.nextOffset;
  }
  return { value, nextOffset };
}

function encodeEnum(declaration: SchemaDeclaration, value: SchemaValue): bigint[] {
  const record = requireRecord(declaration.name, value);
  const variantName = requireString(record.variant, `${declaration.name}.variant`);
  const members = dataMembers(declaration);
  const variantIndex = members.findIndex((member) => member.name === variantName);
  if (variantIndex === -1) throw new Error(`unknown ${declaration.name} variant: ${variantName}`);
  const variant = members[variantIndex];
  return variant.type ? [BigInt(variantIndex), ...encodeType(variant.type, record.value)] : [BigInt(variantIndex)];
}

function decodeEnum(declaration: SchemaDeclaration, felts: readonly bigint[], offset: number): DecodedValue {
  const discriminant = requireFelt(felts, offset, declaration.name);
  const members = dataMembers(declaration);
  if (discriminant >= BigInt(members.length)) throw new Error(`unknown ${declaration.name} discriminant`);
  const variant = members[Number(discriminant)];
  if (!variant.type) return { value: { variant: variant.name }, nextOffset: offset + 1 };
  const decoded = decodeType(variant.type, felts, offset + 1);
  return { value: { variant: variant.name, value: decoded.value }, nextOffset: decoded.nextOffset };
}

function encodeVector(type: string, value: SchemaValue): bigint[] {
  const values = requireArray(type, value);
  const itemType = type.slice(type.indexOf("<") + 1, -1);
  return [BigInt(values.length), ...values.flatMap((item) => encodeType(itemType, item))];
}

function decodeVector(type: string, felts: readonly bigint[], offset: number): DecodedValue {
  const count = requireFelt(felts, offset, type);
  if (count > 262_144n) throw new Error(`vector exceeds global decoder ceiling: ${type}`);
  const itemType = type.slice(type.indexOf("<") + 1, -1);
  const value: unknown[] = [];
  let nextOffset = offset + 1;
  for (let index = 0; index < Number(count); index += 1) {
    const decoded = decodeType(itemType, felts, nextOffset);
    value.push(decoded.value);
    nextOffset = decoded.nextOffset;
  }
  return { value, nextOffset };
}

function encodeTuple(type: string, value: SchemaValue): bigint[] {
  const values = requireArray(type, value);
  const itemTypes = splitTupleTypes(type);
  if (values.length !== itemTypes.length) throw new Error(`wrong tuple arity for ${type}`);
  return itemTypes.flatMap((itemType, index) => encodeType(itemType, values[index]));
}

function decodeTuple(type: string, felts: readonly bigint[], offset: number): DecodedValue {
  const value: unknown[] = [];
  let nextOffset = offset;
  for (const itemType of splitTupleTypes(type)) {
    const decoded = decodeType(itemType, felts, nextOffset);
    value.push(decoded.value);
    nextOffset = decoded.nextOffset;
  }
  return { value, nextOffset };
}

function encodeU256(value: SchemaValue): bigint[] {
  const integer = requireInteger(value, "u256");
  assertUnsignedRange("u256", integer, 256);
  const limbMask = (1n << 128n) - 1n;
  return [integer & limbMask, integer >> 128n];
}

function decodeU256(felts: readonly bigint[], offset: number): DecodedValue {
  const low = requireFelt(felts, offset, "u256.low");
  const high = requireFelt(felts, offset + 1, "u256.high");
  assertUnsignedRange("u128", low, 128);
  assertUnsignedRange("u128", high, 128);
  return { value: low + (high << 128n), nextOffset: offset + 2 };
}

function encodeBoolean(value: SchemaValue): bigint {
  if (value === true) return 1n;
  if (value === false) return 0n;
  throw new Error("bool value must be true or false");
}

function decodeBoolean(felts: readonly bigint[], offset: number): DecodedValue {
  const value = requireFelt(felts, offset, "bool");
  if (value !== 0n && value !== 1n) throw new Error("noncanonical bool");
  return { value: value === 1n, nextOffset: offset + 1 };
}

function encodeBoundedFelt(type: string, value: SchemaValue): bigint {
  const integer = requireInteger(value, type);
  if (type.startsWith("u")) assertUnsignedRange(type, integer, Number(type.slice(1)));
  if ((type === "felt252" || type === "ContractAddress") && (integer < 0n || integer >= FELT_PRIME)) {
    throw new Error(`${type} out of range`);
  }
  return integer;
}

function decodeBoundedFelt(type: string, felts: readonly bigint[], offset: number): DecodedValue {
  const value = requireFelt(felts, offset, type);
  encodeBoundedFelt(type, value);
  return { value, nextOffset: offset + 1 };
}

function resolveDeclaration(type: string): SchemaDeclaration {
  const declaration = DECLARATIONS.get(type);
  if (!declaration) throw new Error(`unregistered schema type: ${type}`);
  return declaration;
}

function dataMembers(declaration: SchemaDeclaration): readonly SchemaMember[] {
  if (!declaration.members || declaration.members.some((member) => typeof member === "string")) {
    throw new Error(`schema has no data members: ${declaration.name}`);
  }
  return declaration.members as readonly SchemaMember[];
}

function requiredAlias(declaration: SchemaDeclaration): string {
  if (!declaration.alias) throw new Error(`missing alias type: ${declaration.name}`);
  return declaration.alias;
}

function requiredMemberType(declarationName: string, member: SchemaMember): string {
  if (!member.type) throw new Error(`missing member type: ${declarationName}.${member.name}`);
  return member.type;
}

function assertExactFields(
  name: string,
  record: Readonly<Record<string, SchemaValue>>,
  members: readonly SchemaMember[],
) {
  const expected = members.map((member) => member.name).sort();
  const actual = Object.keys(record).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`noncanonical fields for ${name}`);
}

function requireRecord(name: string, value: SchemaValue): Readonly<Record<string, SchemaValue>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`);
  return value as Readonly<Record<string, SchemaValue>>;
}

function requireArray(name: string, value: SchemaValue): readonly SchemaValue[] {
  if (!Array.isArray(value)) throw new Error(`${name} must be an array`);
  return value;
}

function requireString(value: SchemaValue | undefined, name: string): string {
  if (typeof value !== "string") throw new Error(`${name} must be a string`);
  return value;
}

function requireInteger(value: SchemaValue, name: string): bigint {
  if (typeof value === "boolean" || typeof value === "object") throw new Error(`${name} must be an integer`);
  const integer = BigInt(value);
  if (typeof value === "number" && !Number.isSafeInteger(value))
    throw new Error(`${name} number is not a safe integer`);
  return integer;
}

function canonicalFelt(value: FeltInput): bigint {
  const felt = requireInteger(value, "felt");
  if (felt < 0n || felt >= FELT_PRIME) throw new Error("felt out of range");
  return felt;
}

function requireFelt(felts: readonly bigint[], offset: number, name: string): bigint {
  const value = felts[offset];
  if (value === undefined) throw new Error(`missing felt for ${name}`);
  return value;
}

function assertUnsignedRange(type: string, value: bigint, bits: number) {
  if (value < 0n || value >= 1n << BigInt(bits)) throw new Error(`${type} out of range`);
}

function isSingleFeltType(type: string): boolean {
  return type === "felt252" || type === "ContractAddress" || /^u(8|16|32|64|128)$/.test(type);
}

function isVectorType(type: string): boolean {
  return /^(Span|Array)<.+>$/.test(type);
}

function isTupleType(type: string): boolean {
  return type.startsWith("(") && type.endsWith(")");
}

function splitTupleTypes(type: string): string[] {
  return type
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim());
}
