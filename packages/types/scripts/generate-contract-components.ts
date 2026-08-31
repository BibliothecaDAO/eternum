#!/usr/bin/env bun
/**
 * Regenerates src/dojo/contract-components.ts from the s2 appchain manifest.
 *
 * Strategy (A4 P1):
 * - Reads the COMMITTED (git HEAD) file as the splice baseline, so the tool is deterministic.
 * - Models/events whose only change vs the baseline is a leading `game_id` key are SPLICED
 *   (existing per-field encodings are proven — keep them byte-identical).
 * - New or restructured models are generated from the manifest's ABI struct/enum registry
 *   (unknown types fail loudly rather than emit a wrong encoding).
 * - Baseline-only models/events (s1/mainnet-only, e.g. Market/Trade/SwapEvent) are carried
 *   verbatim so the mainnet arm keeps compiling.
 * - The namespace becomes a parameter of defineContractComponents (appchain -> "s2",
 *   mainnet -> "s1_eternum"), chosen at bootstrap.
 */
import { $ } from "bun";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../../..");
const MANIFEST_PATH = path.join(ROOT, "contracts/l3/game/manifest_appchain_blitz.json");
const TARGET_REL = "packages/types/src/dojo/contract-components.ts";
const TARGET_PATH = path.join(ROOT, TARGET_REL);

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

const manifest = (await Bun.file(MANIFEST_PATH).json()) as {
  models: ManifestModelLike[];
  events: ManifestModelLike[];
  abis?: AbiEntry[];
};

// ---- ABI struct/enum registry -------------------------------------------------
const structs = new Map<string, { name: string; type: string }[]>();
const enums = new Set<string>();
for (const entry of manifest.abis ?? []) {
  if (entry.type === "struct" && entry.name && entry.members) structs.set(entry.name, entry.members);
  else if (entry.type === "enum" && entry.name) enums.add(entry.name);
}

const shortName = (type: string) => type.split("::").pop() ?? type;

const PRIMITIVE_RECS: Record<string, string> = {
  bool: "RecsType.Boolean",
  u8: "RecsType.Number",
  u16: "RecsType.Number",
  u32: "RecsType.Number",
  u64: "RecsType.Number",
  u128: "RecsType.BigInt",
  u256: "RecsType.BigInt",
  felt252: "RecsType.BigInt",
  ContractAddress: "RecsType.BigInt",
  ClassHash: "RecsType.BigInt",
};

const spanInner = (type: string): string | null => {
  const match = type.match(/^core::array::Span::<(.+)>$/) ?? type.match(/^core::array::Array::<(.+)>$/);
  return match ? match[1] : null;
};

interface EmittedField {
  schema: string;
  types: { short: string; comment: string }[];
  customTypes: string[];
}

const emitMember = (name: string, type: string, structContext: string | null): EmittedField => {
  const leaf = shortName(type);
  const comment = structContext ? `${structContext} ${name}` : name;

  const inner = spanInner(type);
  if (inner) {
    if (inner.startsWith("(")) {
      // Tuple spans follow the existing convention: NumberArray with the tuple type string.
      const tupleShort = inner.replace(/core::integer::|core::felt252/g, (m) =>
        m === "core::felt252" ? "felt252" : "",
      );
      return {
        schema: `${name}: RecsType.NumberArray`,
        types: [{ short: `Span<${tupleShort}>`, comment }],
        customTypes: [],
      };
    }
    const innerLeaf = shortName(inner);
    const recsArray =
      PRIMITIVE_RECS[innerLeaf] === "RecsType.BigInt"
        ? "RecsType.BigIntArray"
        : PRIMITIVE_RECS[innerLeaf] === "RecsType.Number"
          ? "RecsType.NumberArray"
          : "RecsType.StringArray";
    return { schema: `${name}: ${recsArray}`, types: [{ short: `Span<${innerLeaf}>`, comment }], customTypes: [] };
  }
  // The hand-written Troops consumer type (and the spliced ExplorerTroops encoding)
  // treats Stamina fields as bigint despite their u64 Cairo width — stay consistent.
  if (structContext === "Stamina") {
    return { schema: `${name}: RecsType.BigInt`, types: [{ short: leaf, comment }], customTypes: [] };
  }
  if (leaf === "u256") {
    // core::integer::u256 appears in the ABI struct registry — primitives win.
    return { schema: `${name}: RecsType.BigInt`, types: [{ short: "u256", comment }], customTypes: [] };
  }
  if (type === "core::byte_array::ByteArray") {
    // Existing convention: ByteArray is atomic — String schema, "BytesArray" type label.
    return { schema: `${name}: RecsType.String`, types: [{ short: "BytesArray", comment }], customTypes: [] };
  }
  if (PRIMITIVE_RECS[leaf] && !structs.has(type)) {
    return { schema: `${name}: ${PRIMITIVE_RECS[leaf]}`, types: [{ short: leaf, comment }], customTypes: [] };
  }
  if (enums.has(type)) {
    return { schema: `${name}: RecsType.String`, types: [{ short: "enum", comment }], customTypes: [leaf] };
  }
  const nested = structs.get(type);
  if (nested) {
    const parts = nested.map((member) => emitMember(member.name, member.type, leaf));
    const innerSchema = parts.map((part) => `${part.schema},`).join(" ");
    return {
      schema: `${name}: { ${innerSchema} }`,
      types: parts.flatMap((part) => part.types),
      customTypes: [leaf, ...parts.flatMap((part) => part.customTypes)],
    };
  }
  throw new Error(`No RECS mapping for member "${name}" of type "${type}"`);
};

const generateBlock = (modelName: string, members: ManifestMember[], indent: string): string => {
  const parts = members.map((member) => emitMember(member.name, member.type, null));
  const schemaLines = parts.map((part) => `${indent}      ${part.schema},`).join("\n");
  const typeLines = parts
    .flatMap((part) => part.types)
    .map((t) => `${indent}          "${t.short}", // ${t.comment}`)
    .join("\n");
  const customTypes = [...new Set(parts.flatMap((part) => part.customTypes))];
  const customTypesLiteral = customTypes.length ? `["${customTypes.join('", "')}"]` : "[]";
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
${indent}        customTypes: ${customTypesLiteral},
${indent}      } satisfies ContractComponentMetadata,
${indent}    },
${indent}  );
${indent}})(),`;
};

// ---- Baseline (git HEAD) parsing ---------------------------------------------
// The splice baseline is the last PRE-MIGRATION file (s1 encodings). After the first
// regeneration lands, HEAD contains generated output — pin the true baseline instead.
const BASELINE_REF = process.env.BASELINE_REF ?? "a38f092db0";
const baseline = await $`git -C ${ROOT} show ${BASELINE_REF}:${TARGET_REL}`.text();
const mainBlocks = new Map<string, string>();
const eventBlocks = new Map<string, string>();
{
  const lines = baseline.split("\n");
  let inEvents = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^ {4}events: \{$/.test(lines[i])) {
      inEvents = true;
      continue;
    }
    const match = lines[i].match(/^( {4}| {6})(\w+): \(\(\) => \{$/);
    if (!match) continue;
    const name = match[2];
    let depth = 0;
    for (let j = i; j < lines.length; j++) {
      depth += (lines[j].match(/\{/g) ?? []).length - (lines[j].match(/\}/g) ?? []).length;
      if (j > i && depth === 0) {
        (match[1].length === 6 || inEvents ? eventBlocks : mainBlocks).set(name, lines.slice(i, j + 1).join("\n"));
        i = j;
        break;
      }
    }
  }
}

const schemaOpenIndent = (block: string): number => {
  const match = block.match(/^(\s*)\{\s*$/m);
  return match ? match[1].length : 8;
};

const topLevelSchemaKeys = (block: string): string[] => {
  const fieldIndent = schemaOpenIndent(block) + 2;
  const schemaPart = block.slice(0, block.indexOf("metadata:"));
  return [...schemaPart.matchAll(new RegExp(`^ {${fieldIndent}}(\\w+):`, "gm"))].map((m) => m[1]);
};

const spliceGameId = (block: string): string => {
  const open = schemaOpenIndent(block);
  const field = " ".repeat(open + 2);
  const withKey = block.replace(/^(\s*\{\n)/m, `$1${field}game_id: RecsType.Number,\n`);
  const multiline = withKey.replace(
    /(^\s*types: \[\n)(\s*)/m,
    (all, head: string, lead: string) => `${head}${lead}"u32", // game_id\n${lead}`,
  );
  if (multiline !== withKey) return multiline;
  // Single-line arrays: types: ["ContractAddress", ...] and types: [].
  return withKey.replace(/(^\s*types: \[)(?!\n)(\]?)/m, (all, head: string, close: string) =>
    close ? `${head}"u32"${close}` : `${head}"u32", `,
  );
};

// ---- Assemble one group -------------------------------------------------------
const stats = { spliced: 0, generated: 0, carried: 0 };
const assembleGroup = (
  manifestEntries: ManifestModelLike[],
  baselineMap: Map<string, string>,
  indent: string,
): string[] => {
  const entries = manifestEntries
    .map((entry) => ({ name: entry.tag.replace(/^s2-/, ""), members: entry.members }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const s2Names = new Set(entries.map((entry) => entry.name));
  const blocks: string[] = [];
  for (const entry of entries) {
    const block = baselineMap.get(entry.name);
    const manifestKeys = entry.members.map((member) => member.name);
    if (block) {
      const existingKeys = topLevelSchemaKeys(block);
      const gameIdFirst = manifestKeys[0] === "game_id";
      const restMatches =
        gameIdFirst &&
        manifestKeys.slice(1).length === existingKeys.length &&
        manifestKeys.slice(1).every((key, index) => key === existingKeys[index]);
      if (restMatches) {
        blocks.push(spliceGameId(block));
        stats.spliced++;
        continue;
      }
      if (manifestKeys.length === existingKeys.length && manifestKeys.every((key, i) => key === existingKeys[i])) {
        blocks.push(block);
        stats.spliced++;
        continue;
      }
    }
    blocks.push(generateBlock(entry.name, entry.members, indent));
    stats.generated++;
  }
  for (const [name, block] of baselineMap) {
    if (!s2Names.has(name)) {
      blocks.push(block);
      stats.carried++;
    }
  }
  return blocks;
};

const modelBlocks = assembleGroup(manifest.models, mainBlocks, "    ");
const eventGroupBlocks = assembleGroup(manifest.events, eventBlocks, "      ");

const header = `/* Autogenerated by packages/types/scripts/generate-contract-components.ts. Do not edit manually. */

import { defineComponent, Type as RecsType, type World } from "@dojoengine/recs";

export type ContractComponents = ReturnType<typeof defineContractComponents>;

type ContractComponentMetadata = {
  namespace: string;
  name: string;
  types: string[];
  customTypes: string[];
};

type QuestLevelsSchema = {
  game_id: typeof RecsType.Number;
  game_address: typeof RecsType.String;
  levels: typeof RecsType.T;
};

/**
 * namespace: "s2" on appchain worlds, "s1_eternum" on legacy mainnet worlds.
 * Models absent from the active chain simply never receive data.
 */
export function defineContractComponents(world: World, namespace: string) {
  return {
${modelBlocks.join("\n")}
    events: {
${eventGroupBlocks.join("\n")}
    },
  };
}
`;

const output = header.replaceAll('namespace: "s1_eternum",', "namespace,");
await Bun.write(TARGET_PATH, output);
console.log(
  `contract-components.ts regenerated: ${stats.spliced} spliced/unchanged, ${stats.generated} generated, ${stats.carried} carried (baseline-only).`,
);
