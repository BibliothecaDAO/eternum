import { describe, expect, it, vi } from "vitest";
import { CallData, type Abi, type AccountInterface, type Call } from "starknet";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
import { createSystemCalls } from "@bibliothecadao/types";

function setup() {
  const provider = new EternumProvider({ world: "0x77", bridge: "0xb1" }, "http://127.0.0.1:1", {
    gameId: 7,
  });
  const submit = vi.fn(async (_signer: AccountInterface, _call: Call | Call[]) => ({ transaction_hash: "0x55" }));
  provider.setNativeSubmission(submit, bindings.commandAbi as Abi, () => 9);
  const signer = {
    address: "0x123",
    execute: vi.fn().mockResolvedValue({ transaction_hash: "0x44" }),
  } as unknown as AccountInterface;
  const wait = vi.spyOn(provider.provider, "waitForTransaction").mockResolvedValue({ isReverted: () => false } as any);
  const abi = [
    ...bindings.commandAbi,
    {
      type: "function",
      name: "decode_command",
      inputs: [],
      outputs: [{ name: "command", type: "world_native::commands::Command" }],
      state_mutability: "view",
    },
  ];
  const decoded = () => {
    const call = submit.mock.calls.at(-1)![1] as Call;
    expect(call.contractAddress).toBe("0x77");
    expect(call.calldata?.[0]).toBe("7");
    const commands = bindings.commandAbi.find((item) => item.name === "world_native::commands::Command")!;
    const index = commands.variants.findIndex(({ name }) => name === call.entrypoint);
    expect(index).toBeGreaterThanOrEqual(0);
    const fields = (call.calldata as string[]).slice(1);
    expect(BigInt(fields[0])).toBe(BigInt(commands.variants[index].wireId));
    const value = new CallData(abi as Abi).parse("decode_command", [String(index), ...fields.slice(1)]) as any;
    expect(value.command.activeVariant()).toBe(call.entrypoint);
    return value.command.unwrap();
  };
  return { provider, calls: createSystemCalls({ provider }), submit, signer, wait, decoded };
}
describe("player command callers", () => {
  it("encodes an Oath choice, replacement and decline through the signed command caller", async () => {
    const { calls, signer, decoded } = setup();
    await calls.choose_oath({ signer, explorerId: 90, expectedPick: 571, oath: 12, replace: 1 });
    const chosen = decoded();
    expect(chosen.explorer_id).toBe(90n);
    expect(chosen.expected_pick).toBe(571n);
    expect(chosen.oath.unwrap()).toBe(12n);
    expect(chosen.replace.unwrap()).toBe(1n);
    await calls.choose_oath({ signer, explorerId: 90, expectedPick: 571, oath: null, replace: null });
    expect(decoded().oath.isNone()).toBe(true);
    expect(decoded().replace.isNone()).toBe(true);
  });

  it("encodes an Oath card reroll through the signed command caller", async () => {
    const { calls, signer, decoded } = setup();
    await calls.reroll_oath({ signer, explorerId: 90, expectedPick: 4667, index: 2 });
    expect(decoded()).toEqual({ explorer_id: 90n, expected_pick: 4667n, index: 2n });
  });

  it("encodes both home and cleared-camp reinforcement through the compiled command ABI", async () => {
    const { calls, signer, decoded } = setup();
    await calls.explorer_add({ signer, to_explorer_id: 90, amount: 1000000000, supply_post: 711 });
    const camp = decoded();
    expect(camp.activeVariant()).toBe("RecruitExplorer");
    expect(camp.unwrap().explorer_id).toBe(90n);
    expect(camp.unwrap().amount).toBe(1000000000n);
    expect(camp.unwrap().supply_post.unwrap()).toBe(711n);
    await calls.explorer_add({ signer, to_explorer_id: 90, amount: 1000000000 });
    expect(decoded().unwrap().supply_post.isNone()).toBe(true);
  });
  it("collects the selected home's reward for its exact game day", async () => {
    const { calls, signer, submit, decoded } = setup();
    await calls.claim_daily_quest({ signer, home: 7, day: 3 });
    expect(submit.mock.calls.at(-1)![1]).toMatchObject({ entrypoint: "ClaimDailyQuest" });
    expect(decoded()).toEqual({ home: 7n, day: 3n });
  });
  it("encodes a clearing attack's replacement slot and free army relic activation", async () => {
    const { calls, signer, decoded } = setup();
    await calls.attack_explorer_vs_guard({ signer, explorer_id: 90, structure_id: 12, relic_slot: 2 });
    expect(decoded().relic_slot.unwrap()).toBe(2n);
    await calls.attack_explorer_vs_guard({ signer, explorer_id: 90, structure_id: 12 });
    expect(decoded().relic_slot.isNone()).toBe(true);
    await calls.apply_relic({ signer, entity_id: 90, relic_resource_id: 25, relic_slot: 2 });
    const activation = decoded();
    expect(activation.entity_id).toBe(90n);
    expect(activation.relic_id).toBe(25n);
    expect(activation.slot).toBe(2n);
  });
  it("carries the chosen army slot through system calls and the provider into CreateExplorer", async () => {
    const { calls, signer, submit, decoded } = setup();
    await calls.explorer_create({
      signer,
      for_structure_id: 12,
      category: 0,
      tier: 0,
      amount: 100,
      spawn_direction: 4,
      slot: 2,
    });
    expect(submit.mock.calls.at(-1)![1]).toMatchObject({ entrypoint: "CreateExplorer" });
    expect(decoded()).toEqual({ structure_id: 12n, category: 0n, tier: 0n, amount: 100n, direction: 4n, slot: 2n });
  });
});
