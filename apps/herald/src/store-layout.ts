import type { EnumAbiEntry, Felt, ManifestAbiEntry, ManifestMember, StructAbiEntry } from "./types";

interface TransformResult {
  felts: Felt[];
  nextOffset: number;
}

const ARRAY_PREFIXES = ["core::array::Array::<", "core::array::Span::<"] as const;

const isNamedType = (entry: ManifestAbiEntry): entry is StructAbiEntry | EnumAbiEntry =>
  (entry.type === "struct" || entry.type === "enum") && typeof entry.name === "string";

const splitTuple = (value: string): string[] => {
  const entries: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ("(<[".includes(character)) depth += 1;
    if (")>]".includes(character)) depth -= 1;
    if (character === "," && depth === 0) {
      entries.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  entries.push(value.slice(start).trim());
  return entries.filter(Boolean);
};

const genericInnerType = (type: string, prefix: string): string | undefined =>
  type.startsWith(prefix) && type.endsWith(">") ? type.slice(prefix.length, -1) : undefined;

const transformScalar = (type: string, felts: Felt[], offset: number): TransformResult => {
  const felt = felts[offset];
  if (felt === undefined) throw new Error(`Store payload ended while decoding ${type}`);
  return { felts: [felt], nextOffset: offset + 1 };
};

export class StoreLayout {
  private readonly typesByName: ReadonlyMap<string, StructAbiEntry | EnumAbiEntry>;

  constructor(abi: readonly ManifestAbiEntry[]) {
    this.typesByName = new Map(abi.filter(isNamedType).map((entry) => [entry.name, entry]));
  }

  public normalizeMembers(members: readonly Pick<ManifestMember, "name" | "type">[], felts: Felt[]): Felt[] {
    const transformed = this.transformTypes(
      members.map(({ type }) => type),
      felts,
      0,
    );
    if (transformed.nextOffset !== felts.length) {
      throw new Error(`Store layout consumed ${transformed.nextOffset} of ${felts.length} felts`);
    }
    return transformed.felts;
  }

  private transformTypes(types: readonly string[], felts: Felt[], offset: number): TransformResult {
    const normalized: Felt[] = [];
    let cursor = offset;
    for (const type of types) {
      const transformed = this.transformType(type, felts, cursor);
      normalized.push(...transformed.felts);
      cursor = transformed.nextOffset;
    }
    return { felts: normalized, nextOffset: cursor };
  }

  private transformType(typeInput: string, felts: Felt[], offset: number): TransformResult {
    const type = typeInput.startsWith("@") ? typeInput.slice(1) : typeInput;
    if (type === "()") return { felts: [], nextOffset: offset };

    for (const prefix of ARRAY_PREFIXES) {
      const innerType = genericInnerType(type, prefix);
      if (innerType) return this.transformArray(innerType, felts, offset);
    }
    if (type.startsWith("(") && type.endsWith(")")) {
      return this.transformTypes(splitTuple(type.slice(1, -1)), felts, offset);
    }

    const fixedArray = /^\[(.*);\s*(\d+)\]$/.exec(type);
    if (fixedArray) {
      return this.transformTypes(Array(Number(fixedArray[2])).fill(fixedArray[1]), felts, offset);
    }

    const definition = this.typesByName.get(type);
    if (definition?.type === "struct") {
      return this.transformTypes(
        definition.members.map(({ type: memberType }) => memberType),
        felts,
        offset,
      );
    }
    if (definition?.type === "enum") return this.transformEnum(definition, felts, offset);

    if (type.startsWith("core::") || type.startsWith("cubit::")) return transformScalar(type, felts, offset);
    throw new Error(`Store layout has no ABI definition for ${type}`);
  }

  private transformArray(innerType: string, felts: Felt[], offset: number): TransformResult {
    const lengthFelt = felts[offset];
    if (lengthFelt === undefined) throw new Error(`Store payload ended before ${innerType} array length`);
    const length = Number(BigInt(lengthFelt));
    if (!Number.isSafeInteger(length) || length < 0) throw new Error(`Invalid Store array length ${lengthFelt}`);
    const body = this.transformTypes(Array(length).fill(innerType), felts, offset + 1);
    return { felts: [lengthFelt, ...body.felts], nextOffset: body.nextOffset };
  }

  private transformEnum(definition: EnumAbiEntry, felts: Felt[], offset: number): TransformResult {
    if (definition.name === "core::bool") return transformScalar(definition.name, felts, offset);

    const storeSelector = felts[offset];
    if (storeSelector === undefined) throw new Error(`Store payload ended before ${definition.name} selector`);
    const variantIndex = Number(BigInt(storeSelector)) - 1;
    const variant = definition.variants[variantIndex];
    if (!variant) throw new Error(`Store enum ${definition.name} has invalid selector ${storeSelector}`);
    const payload = this.transformType(variant.type, felts, offset + 1);
    return {
      felts: [`0x${variantIndex.toString(16)}`, ...payload.felts],
      nextOffset: payload.nextOffset,
    };
  }
}
