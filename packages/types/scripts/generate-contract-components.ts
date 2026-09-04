#!/usr/bin/env bun
/**
 * Regenerates src/dojo/contract-components.ts from the current Madara manifest.
 *
 * The manifest is the schema authority. Every model and event is generated on
 * every run, and an unknown Cairo type fails instead of producing a fallback.
 */
import path from "node:path";
import { format, resolveConfig } from "prettier";

const ROOT = path.resolve(import.meta.dir, "../../..");
const MANIFEST_PATH = path.join(ROOT, "contracts/l3/game/manifest_madara.json");
const TARGET_REL = "packages/types/src/dojo/contract-components.ts";
const COMMITTED_TARGET_PATH = path.join(ROOT, TARGET_REL);
const TARGET_PATH = process.env.CONTRACT_COMPONENTS_OUTPUT
  ? path.resolve(process.env.CONTRACT_COMPONENTS_OUTPUT)
  : COMMITTED_TARGET_PATH;

interface ManifestMember {
  name: string;
  type: string;
  key: boolean;
}

interface AbiEntry {
  type: string;
  name?: string;
  members?: { name: string; type: string }[];
  variants?: { name: string; type: string }[];
}

interface ManifestModelLike {
  tag: string;
  members: ManifestMember[];
}

interface RecsMapping {
  schema: string;
  optionalSchema?: string;
  typeLabel: string;
}

interface EmittedField {
  schema: string;
  types: { label: string; comment: string }[];
}

const manifest = (await Bun.file(MANIFEST_PATH).json()) as {
  models: ManifestModelLike[];
  events: ManifestModelLike[];
  abis?: AbiEntry[];
};

const structs = new Map<string, { name: string; type: string }[]>();
const enums = new Map<string, { name: string; type: string }[]>();

for (const entry of manifest.abis ?? []) {
  if (entry.type === "struct" && entry.name && entry.members) {
    structs.set(entry.name, entry.members);
  } else if (entry.type === "enum" && entry.name && entry.variants) {
    enums.set(entry.name, entry.variants);
  }
}

const shortName = (type: string) => type.split("::").pop() ?? type;

const PRIMITIVE_MAPPINGS: Record<string, RecsMapping> = {
  bool: { schema: "RecsType.Boolean", typeLabel: "bool" },
  u8: { schema: "RecsType.Number", optionalSchema: "RecsType.OptionalNumber", typeLabel: "u8" },
  u16: { schema: "RecsType.Number", optionalSchema: "RecsType.OptionalNumber", typeLabel: "u16" },
  u32: { schema: "RecsType.Number", optionalSchema: "RecsType.OptionalNumber", typeLabel: "u32" },
  u64: { schema: "RecsType.BigInt", optionalSchema: "RecsType.OptionalBigInt", typeLabel: "u64" },
  u128: { schema: "RecsType.BigInt", optionalSchema: "RecsType.OptionalBigInt", typeLabel: "u128" },
  u256: { schema: "RecsType.BigInt", optionalSchema: "RecsType.OptionalBigInt", typeLabel: "u256" },
  felt252: { schema: "RecsType.BigInt", optionalSchema: "RecsType.OptionalBigInt", typeLabel: "felt252" },
  ContractAddress: {
    schema: "RecsType.BigInt",
    optionalSchema: "RecsType.OptionalBigInt",
    typeLabel: "ContractAddress",
  },
  ClassHash: { schema: "RecsType.BigInt", optionalSchema: "RecsType.OptionalBigInt", typeLabel: "ClassHash" },
};

const genericInner = (type: string, generic: "Span" | "Array" | "Option"): string | null => {
  const namespace = generic === "Option" ? "core::option" : "core::array";
  const match = type.match(new RegExp(`^${namespace}::${generic}::<(.+)>$`));
  return match?.[1] ?? null;
};

const splitTupleMembers = (type: string): string[] | null => {
  if (!type.startsWith("(") || !type.endsWith(")")) return null;

  const members: string[] = [];
  let start = 1;
  let depth = 0;
  for (let index = 1; index < type.length - 1; index++) {
    const character = type[index];
    if (character === "(" || character === "<") depth++;
    if (character === ")" || character === ">") depth--;
    if (character === "," && depth === 0) {
      members.push(type.slice(start, index).trim());
      start = index + 1;
    }
  }
  members.push(type.slice(start, -1).trim());
  return members;
};

const tupleTypeLabel = (type: string): string | null => {
  const members = splitTupleMembers(type);
  return members ? `(${members.map(shortName).join(", ")})` : null;
};

const isUnitEnum = (type: string): boolean => enums.get(type)?.every((variant) => variant.type === "()") ?? false;

const atomicMapping = (type: string): RecsMapping | null => {
  const primitive = PRIMITIVE_MAPPINGS[shortName(type)];
  if (primitive) return primitive;
  if (type === "core::byte_array::ByteArray") {
    return { schema: "RecsType.String", optionalSchema: "RecsType.OptionalString", typeLabel: "BytesArray" };
  }
  if (isUnitEnum(type)) {
    return { schema: "RecsType.String", optionalSchema: "RecsType.OptionalString", typeLabel: "enum" };
  }
  if (enums.has(type)) {
    return { schema: "RecsType.T", typeLabel: "enum" };
  }
  return null;
};

const emitOption = (name: string, inner: string, comment: string): EmittedField => {
  const mapping = atomicMapping(inner);
  if (!mapping?.optionalSchema) {
    throw new Error(`No optional RECS mapping for member "${name}" of type "${inner}"`);
  }
  return {
    schema: `${name}: ${mapping.optionalSchema}`,
    types: [{ label: `Option<${shortName(inner)}>`, comment }],
  };
};

const emitSpan = (name: string, inner: string, comment: string): EmittedField => {
  const tupleLabel = tupleTypeLabel(inner);
  if (tupleLabel) {
    return {
      schema: `${name}: RecsType.NumberArray`,
      types: [{ label: `Span<${tupleLabel}>`, comment }],
    };
  }

  const mapping = atomicMapping(inner);
  if (mapping) {
    const schema =
      mapping.schema === "RecsType.BigInt"
        ? "RecsType.BigIntArray"
        : mapping.schema === "RecsType.Number"
          ? "RecsType.NumberArray"
          : mapping.schema === "RecsType.String"
            ? "RecsType.StringArray"
            : null;
    if (!schema) throw new Error(`No array RECS mapping for member "${name}" of type "${inner}"`);
    return { schema: `${name}: ${schema}`, types: [{ label: `Span<${shortName(inner)}>`, comment }] };
  }

  if (structs.has(inner)) {
    return {
      schema: `${name}: RecsType.T`,
      types: [{ label: `Span<${shortName(inner)}>`, comment }],
    };
  }
  throw new Error(`No span RECS mapping for member "${name}" of type "${inner}"`);
};

const emitMember = (name: string, type: string, structContext: string | null): EmittedField => {
  const comment = structContext ? `${structContext} ${name}` : name;
  const spanInner = genericInner(type, "Span") ?? genericInner(type, "Array");
  if (spanInner) return emitSpan(name, spanInner, comment);

  const optionInner = genericInner(type, "Option");
  if (optionInner) return emitOption(name, optionInner, comment);

  const tupleLabel = tupleTypeLabel(type);
  if (tupleLabel) {
    return {
      schema: `${name}: RecsType.BigIntArray`,
      types: [{ label: tupleLabel, comment }],
    };
  }

  const mapping = atomicMapping(type);
  if (mapping) {
    return {
      schema: `${name}: ${mapping.schema}`,
      types: [{ label: mapping.typeLabel, comment }],
    };
  }

  const nested = structs.get(type);
  if (nested) {
    const parts = nested.map((member) => emitMember(member.name, member.type, shortName(type)));
    return {
      schema: `${name}: { ${parts.map((part) => `${part.schema},`).join(" ")} }`,
      types: parts.flatMap((part) => part.types),
    };
  }
  throw new Error(`No RECS mapping for member "${name}" of type "${type}"`);
};

const generateBlock = (modelName: string, members: ManifestMember[], indent: string): string => {
  const parts = members.map((member) => emitMember(member.name, member.type, null));
  const schemaLines = parts.map((part) => `${indent}      ${part.schema},`).join("\n");
  const typeLines = parts
    .flatMap((part) => part.types)
    .map(({ label, comment }) => `${indent}          "${label}", // ${comment}`)
    .join("\n");

  return `${indent}${modelName}: (() => {
${indent}  return defineComponent(
${indent}    world,
${indent}    {
${schemaLines}
${indent}    },
${indent}    {
${indent}      metadata: {
${indent}        namespace,
${indent}        name: "${modelName}",
${indent}        types: [
${typeLines}
${indent}        ],
${indent}      } satisfies ContractComponentMetadata,
${indent}    },
${indent}  );
${indent}})(),`;
};

const generateGroup = (entries: ManifestModelLike[], indent: string): string[] =>
  entries
    .map((entry) => ({ name: entry.tag.replace(/^s2-/, ""), members: entry.members }))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => generateBlock(entry.name, entry.members, indent));

const modelBlocks = generateGroup(manifest.models, "    ");
const eventBlocks = generateGroup(manifest.events, "      ");

const output = `/* Autogenerated by packages/types/scripts/generate-contract-components.ts. Do not edit manually. */

import { defineComponent, Type as RecsType, type World } from "@dojoengine/recs";

export type ContractComponents = ReturnType<typeof defineContractComponents>;

type ContractComponentMetadata = {
  namespace: string;
  name: string;
  types: string[];
};

/**
 * The namespace identifies the active Dojo world's model namespace.
 * Models absent from that world simply never receive data.
 */
export function defineContractComponents(world: World, namespace: string) {
  return {
${modelBlocks.join("\n")}
    events: {
${eventBlocks.join("\n")}
    },
  };
}
`;

const prettierConfig = (await resolveConfig(COMMITTED_TARGET_PATH)) ?? {};
const formattedOutput = await format(output, { ...prettierConfig, filepath: COMMITTED_TARGET_PATH });
await Bun.write(TARGET_PATH, formattedOutput);
console.log(
  `contract-components.ts regenerated from manifest_madara.json: ${modelBlocks.length} models, ${eventBlocks.length} events.`,
);
