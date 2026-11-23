import { tupleTypes } from "../../../../apps/herald/src/native/serde.ts";

export function feltLengths(types) {
  function feltLength(type) {
    if (type === "()") return 0;
    if (type.startsWith("(")) return sumLengths(tupleTypes(type).map(feltLength));
    if (/^core::array::(Span|Array)::</.test(type)) return null;
    const item = types.get(type);
    if (item?.type === "struct") return sumLengths(item.members.map((member) => feltLength(member.type)));
    if (item?.type === "enum") {
      const lengths = item.variants.map((variant) => feltLength(variant.type));
      if (lengths.includes(null) || new Set(lengths).size !== 1) return null;
      return 1 + lengths[0];
    }
    if (
      /^core::(felt252|integer::u(8|16|32|64|128)|starknet::(contract_address::ContractAddress|class_hash::ClassHash))$/.test(
        type,
      )
    ) {
      return 1;
    }
    throw new Error(`Unsupported row type ${type}`);
  }
  return feltLength;
}

export function sumLengths(lengths) {
  return lengths.includes(null) ? null : lengths.reduce((sum, length) => sum + length, 0);
}
