import { resolve } from "node:path";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { expect, test } from "bun:test";
import { encodeNativeCommand, type NativeCommand } from "../../../packages/provider/src/native-command";
import { commandArguments, signedRequest, type NativeFixture } from "./native-intent";
import { ec, hash } from "starknet";
const fixture = { execution: { address: "0x12" } } as NativeFixture;

test("fixture commands use the shared compiled ABI encoder, including nested options", () => {
  const native = { ...fixture, nativeSource: resolve(import.meta.dir, "../../..") };
  const commands: NativeCommand[] = [
    { kind: "Explore", value: { explorer_id: 17, direction: 2 } },
    { kind: "SettleSeason", value: { name: "0x123", selected_realm: { kind: "Some", value: 7 } } },
    { kind: "CloseSeason", value: undefined },
  ];
  for (const command of commands) {
    expect(commandArguments(native, command)).toEqual(encodeNativeCommand(bindings.commandAbi, command));
  }
  expect(() => commandArguments(native, { kind: "Explore", value: { explorer_id: 17 } } as NativeCommand)).toThrow("Fields do not match");
});

test("fixture intents use the configured signer rather than a fixed test key", () => {
  const fixture = { chain: "0x1", execution: { address: "0x2" }, actor: "0x3", game: "0x4" } as NativeFixture;
  for (const key of ["0x5678", "0x9abc"]) {
    const request = signedRequest(fixture, ["1", "2", "3", "4", "5", "1000"], ["7"], key);
    expect(request.public_key).toBe(ec.starkCurve.getStarkKey(key));
    expect(ec.starkCurve.verify(
      new ec.starkCurve.Signature(BigInt(request.r), BigInt(request.s)),
      hash.computePoseidonHashOnElements(request.intent), ec.starkCurve.getPublicKey(key),
    )).toBe(true);
  }
});
