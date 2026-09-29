import {
  CallData,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
  hash,
  shortString,
  uint256,
  type Abi,
  type BigNumberish,
} from "starknet";
import type { NativeCommand } from "../../../contracts/l3/world-native/schema/commands.gen";
export type { NativeCommand, NativeCommandPayloads } from "../../../contracts/l3/world-native/schema/commands.gen";

type AbiType = {
  type: string;
  name: string;
  members?: { name: string; type: string }[];
  variants?: { name: string; type: string }[];
};

/** The compiled enum supplies both the variant discriminant and every field's serialization order. */
export function encodeNativeCommand(abi: Abi, command: NativeCommand): string[] {
  const types = new Map((abi as AbiType[]).map((item) => [item.name, item]));
  return new CallData(abi).compile("command_commitment", {
    command: encodeValue("world_native::commands::Command", command, types) as CairoCustomEnum,
  });
}

function encodeValue(type: string, value: unknown, types: Map<string, AbiType>): unknown {
  if (type === "()") {
    if (value !== undefined) throw new Error("Unit command must not carry a payload");
    return {};
  }
  if (type === "core::integer::u256") return uint256.bnToUint256(value as BigNumberish);
  const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
  if (span) {
    if (!Array.isArray(value)) throw new Error(`Expected array for ${type}`);
    return value.map((item) => encodeValue(span[1], item, types));
  }
  const definition = types.get(type);
  if (definition?.type === "enum" && type !== "core::bool") {
    const selected = value as { kind?: string; value?: unknown };
    const variant = definition.variants!.find(({ name }) => name === selected?.kind);
    if (!variant) throw new Error(`Unknown ${type} variant ${selected?.kind}`);
    const payload = encodeValue(variant.type, selected.value, types);
    if (type.startsWith("core::option::Option::<"))
      return new CairoOption(variant.name === "Some" ? CairoOptionVariant.Some : CairoOptionVariant.None, payload);
    return new CairoCustomEnum({ [variant.name]: payload });
  }
  if (definition?.type === "struct") {
    if (!value || typeof value !== "object") throw new Error(`Missing ${type} payload`);
    const fields = value as Record<string, unknown>;
    const members = definition.members!;
    if (Object.keys(fields).length !== members.length || members.some(({ name }) => !(name in fields)))
      throw new Error(`Fields do not match ${type}`);
    return Object.fromEntries(members.map(({ name, type }) => [name, encodeValue(type, fields[name], types)]));
  }
  return value;
}

function nativeTaggedHash(tag: string, fields: readonly BigNumberish[]): string {
  return hash.computePoseidonHashOnElements([shortString.encodeShortString(tag), 1, ...fields]);
}

export function frameNativeIntent(input: {
  chain: BigNumberish;
  deployment: BigNumberish;
  gameId: BigNumberish;
  actor: BigNumberish;
  nonce: BigNumberish;
  releaseId: BigNumberish;
  presetCommitment: BigNumberish;
  validFrom: BigNumberish;
  validUntil: BigNumberish;
  lastOrder: BigNumberish;
  arguments: readonly string[];
}): string[] {
  return [
    shortString.encodeShortString("ETERNUM_ACTION"),
    2,
    input.chain,
    input.deployment,
    input.gameId,
    input.actor,
    input.nonce,
    nativeTaggedHash("ETERNUM_COMMAND", input.arguments),
    input.releaseId,
    input.presetCommitment,
    input.validFrom,
    input.validUntil,
    input.lastOrder,
    input.arguments.length,
    ...input.arguments,
  ].map((value) => `0x${BigInt(value).toString(16)}`);
}
