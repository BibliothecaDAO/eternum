import { resolve } from "node:path";
import bindings from "../../contracts/l3/world-native/schema/bindings.json";
import { expect, test } from "bun:test";
import { hash, shortString, type RpcProvider } from "starknet";
import { encodeNativeCommand, frameNativeIntent, type NativeCommand } from "../../packages/provider/src/native-command";
import { commandArguments, recoveryProgress, type NativeFixture } from "./native-intent";

const encode = (fields: (string | number | bigint)[]) =>
  fields.map((value) => BigInt(value).toString(16).padStart(64, "0")).join("");
const fixture = { execution: { address: "0x12" } } as NativeFixture;
const intent = frameNativeIntent({
  chain: "0x1",
  deployment: "0x12",
  gameId: 3,
  actor: "0x45",
  nonce: 2,
  rules: "0x67",
  validFrom: 100,
  validUntil: 200,
  lastOrder: 7,
  arguments: ["0x0"],
});
const envelope = [
  shortString.encodeShortString("ETERNUM_ENTROPY"),
  2,
  hash.computePoseidonHashOnElements(intent),
  7,
  99,
  150,
  8,
  1_200_000_000,
  1234,
  5678,
];
const binding = hash.computePoseidonHashOnElements(envelope);
const ticket = {
  ticket_order: 7,
  intent: encode(intent),
  envelope: encode(envelope),
  binding: encode([binding]),
  transactions: ["abc"],
};
function receipt(status = 1, reason = 0, consumed = 1) {
  return {
    execution_status: "SUCCEEDED",
    events: [
      {
        from_address: "0x12",
        keys: [hash.getSelectorFromName("RecordingEvent"), hash.getSelectorFromName("ExecutionRecorded")],
        data: [3, 0x45, 2, consumed, 7, status, reason].map(String),
      },
    ],
  };
}
function provider(read: () => unknown): Pick<RpcProvider, "getTransactionReceipt"> {
  return { getTransactionReceipt: async () => read() } as Pick<RpcProvider, "getTransactionReceipt">;
}

test("recovery derives successful state from the receipt and retained binding", async () => {
  const state = hash.computePoseidonHashOnElements([99, binding, 1, 0, 1]);
  expect(
    await recoveryProgress(
      provider(() => receipt()),
      fixture,
      ticket,
    ),
  ).toEqual(["0x1", binding, state, state]);
});
test("terminal rejection preserves a stale actor nonce and commits its reason", async () => {
  const state = hash.computePoseidonHashOnElements([99, binding, 2, 17, 0]);
  expect(
    await recoveryProgress(
      provider(() => receipt(2, 17, 0)),
      fixture,
      ticket,
    ),
  ).toEqual(["0x2", binding, "0x11", state]);
});
test("missing or reverted transactions establish no recorded outcome", async () => {
  expect(
    await recoveryProgress(
      provider(() => {
        throw { baseError: { code: 29 } };
      }),
      fixture,
      ticket,
    ),
  ).toEqual(["0x0", "0x0", "0x0", "0x0"]);
  expect(
    await recoveryProgress(
      provider(() => ({ execution_status: "REVERTED" })),
      fixture,
      ticket,
    ),
  ).toEqual(["0x0", "0x0", "0x0", "0x0"]);
});
test("a transport failure is not mistaken for an unexecuted ticket", async () => {
  await expect(
    recoveryProgress(
      provider(() => {
        throw new Error("connection lost");
      }),
      fixture,
      ticket,
    ),
  ).rejects.toThrow("connection lost");
});
test("recovery rejects a mismatched receipt or binding", async () => {
  const wrong = receipt();
  wrong.events[0].data[2] = "3";
  await expect(
    recoveryProgress(
      provider(() => wrong),
      fixture,
      ticket,
    ),
  ).rejects.toThrow();
  await expect(
    recoveryProgress(
      provider(() => receipt()),
      fixture,
      { ...ticket, binding: encode([123]) },
    ),
  ).rejects.toThrow();
});

test("fixture commands use the shared compiled ABI encoder, including nested options", () => {
  const native = { ...fixture, nativeSource: resolve(import.meta.dir, "../..") };
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
