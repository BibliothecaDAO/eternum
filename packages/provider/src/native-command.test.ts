import { describe, expect, it } from "vitest";
import { CallData, hash, shortString, type Abi } from "starknet";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { encodeNativeCommand, frameNativeIntent, type NativeCommand } from "./native-command";
const abi = bindings.commandAbi as Abi;
const types = new Map(bindings.commandAbi.map((item) => [item.name, item]));
const command = types.get("world_native::commands::Command")!;
function example(type: string): unknown {
  if (type === "()") return undefined;
  if (type === "core::bool") return true;
  if (type === "core::integer::u256") return (1n << 200n) + 7n;
  const span = /^core::array::(?:Span|Array)::<(.+)>$/.exec(type);
  if (span) return [example(span[1])];
  const shape = types.get(type);
  if (shape?.type === "struct") return Object.fromEntries(shape.members.map(({ name, type }) => [name, example(type)]));
  if (shape?.type === "enum") return { kind: shape.variants[0].name, value: example(shape.variants[0].type) };
  return 7n;
}
describe("compiled native commands", () => {
  it.each(command.variants.map((variant, index) => [variant.name, variant.type, index] as const))(
    "encodes %s with the ABI discriminant and decodes its payload",
    (kind, type, index) => {
      const fields = encodeNativeCommand(abi, { kind, value: example(type) } as NativeCommand);
      expect(BigInt(fields[0])).toBe(BigInt(index));
      const decodeAbi = [
        ...abi,
        {
          type: "function",
          name: "decode_command",
          inputs: [],
          outputs: [{ name: "command", type: "world_native::commands::Command" }],
          state_mutability: "view",
        },
      ];
      const decoded = new CallData(decodeAbi).parse("decode_command", fields) as {
        command: { activeVariant(): string };
      };
      expect(decoded.command.activeVariant()).toBe(kind);
      expect(new CallData(abi).compile("command_commitment", decoded)).toEqual(fields);
    },
  );
  it("rejects unknown variants and missing or extra named fields", () => {
    expect(() => encodeNativeCommand(abi, { kind: "Invented", value: undefined } as unknown as NativeCommand)).toThrow(
      "Unknown",
    );
    expect(() => encodeNativeCommand(abi, { kind: "Explore", value: { explorer_id: 1 } } as NativeCommand)).toThrow(
      "Fields do not match",
    );
    expect(() =>
      encodeNativeCommand(abi, { kind: "Explore", value: { explorer_id: 1, direction: 0, extra: 3 } } as NativeCommand),
    ).toThrow("Fields do not match");
  });
  it("frames the published intent without a second command serializer", () => {
    const args = encodeNativeCommand(abi, { kind: "Explore", value: { explorer_id: 9, direction: 2 } });
    expect(args.map(BigInt)).toEqual([1n, 9n, 2n]);
    const encoded = frameNativeIntent({
      chain: 1,
      deployment: 2,
      gameId: 3,
      actor: 4,
      nonce: 5,
      releaseId: 1,
      presetCommitment: 6,
      validFrom: 7,
      validUntil: 8,
      lastOrder: 9,
      arguments: args,
    });
    expect(encoded.map(BigInt)).toEqual([
      BigInt(shortString.encodeShortString("ETERNUM_ACTION")),
      2n,
      1n,
      2n,
      3n,
      4n,
      5n,
      BigInt(hash.computePoseidonHashOnElements([shortString.encodeShortString("ETERNUM_COMMAND"), 1, 1, 9, 2])),
      1n,
      6n,
      7n,
      8n,
      9n,
      3n,
      1n,
      9n,
      2n,
    ]);
  });
});
