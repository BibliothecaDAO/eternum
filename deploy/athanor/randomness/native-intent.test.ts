import { resolve } from "node:path";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { expect, test } from "bun:test";
import { encodeNativeCommand, type NativeCommand } from "../../../packages/provider/src/native-command";
import { commandArguments, type NativeFixture } from "./native-intent";
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
