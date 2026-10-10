import { expect, test } from "bun:test";
import { hash } from "starknet";
import { assertWorkerCreation, readRoleHandoffState } from "./service-role-check";

test("activation requires a single real creation signed by the enrolled Worker on this world", () => {
  const expected = { account: "0x12", world: "0x34", name: "0x56", preset: 5 };
  const calldata = ["0x1", expected.world, hash.getSelectorFromName("create_game"), "0x2", expected.name, "0x5"];
  const tx = { type: "INVOKE", sender_address: expected.account, calldata };
  expect(() => assertWorkerCreation(tx, expected)).not.toThrow();
  expect(() => assertWorkerCreation({ ...tx, sender_address: "0x99" }, expected)).toThrow();
  expect(() => assertWorkerCreation({ ...tx, type: "DECLARE" }, expected)).toThrow();
  for (const index of [0, 1, 2, 3, 4, 5]) {
    const invalid = [...calldata];
    invalid[index] = "0x99";
    expect(() => assertWorkerCreation({ ...tx, calldata: invalid }, expected)).toThrow();
  }
  expect(() => assertWorkerCreation({ ...tx, calldata: [...calldata, "0x1"] }, expected)).toThrow();
});

test("role handoff state comes only from the three Games views, without a Worker intent or any signing", async () => {
  for (const [installed, handedOff] of [
    ["0x0012", false],
    ["0x34", true],
  ] as const) {
    const calls: unknown[] = [];
    const state = await readRoleHandoffState({
      provider: {
        async callContract(...args: unknown[]) {
          calls.push(args);
          return [installed];
        },
      },
      world: "0x56",
      bootstrap: "0x12",
    });
    expect(state).toEqual({ handedOff });
    expect(calls).toEqual(
      ["owner", "launcher", "ledger_operator"].map((entrypoint) => [
        { contractAddress: "0x56", entrypoint, calldata: [] },
        "latest",
      ]),
    );
  }
});

test("a missing or malformed launcher view fails instead of assuming bootstrap authority", async () => {
  for (const reply of [[], ["not a felt"], ["0x12", "0x34"]])
    await expect(
      readRoleHandoffState({
        provider: {
          async callContract() {
            return reply;
          },
        },
        world: "0x56",
        bootstrap: "0x12",
      }),
    ).rejects.toThrow();
  await expect(
    readRoleHandoffState({
      provider: {
        async callContract() {
          throw new Error("node unavailable");
        },
      },
      world: "0x56",
      bootstrap: "0x12",
    }),
  ).rejects.toThrow();
});
