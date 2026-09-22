import { describe, expect, it, vi } from "vitest";
import { CallData, type Abi, type AccountInterface, type Call } from "starknet";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider } from "./index";
import { createSystemCalls } from "@bibliothecadao/types";

function setup() {
  const provider = new EternumProvider(
    {
      native: { version: 1, domains: { bridge: { address: "0xb1" } } },
      world: { address: "0x77" },
      contracts: [],
    } as any,
    "http://127.0.0.1:1",
    undefined,
    { gameId: 7 },
  );
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
    const value = new CallData(abi as Abi).parse("decode_command", (call.calldata as string[]).slice(1)) as any;
    expect(value.command.activeVariant()).toBe(call.entrypoint);
    return value.command.unwrap();
  };
  return { provider, calls: createSystemCalls({ provider }), submit, signer, wait, decoded };
}
describe("player command callers", () => {
  it("preserves exact contribution units through the compiled command ABI", async () => {
    const { calls, signer, decoded } = setup();
    const amount = 9_007_199_254_740_993n;
    await calls.contribute_to_construction({
      signer,
      hyperstructure_entity_id: 9,
      contributor_entity_id: 4,
      contributions: [{ resource: 1, amount }],
    });
    expect(decoded()).toEqual({
      hyperstructure_id: 9n,
      from_structure_id: 4n,
      resources: [{ resource_type: 1n, amount }],
    });
  });

  it("approves the native bridge before submitting a deposit", async () => {
    const { calls, signer, submit, wait, decoded } = setup();
    const amount = (1n << 180n) + 3n;
    await calls.bridge_deposit_into_realm({
      signer,
      recipient_structure_id: 9,
      client_fee_recipient: 0,
      resources: [{ resource_type: 2, tokenAddress: "0xaa", amount }],
    });
    expect(signer.execute).toHaveBeenCalledWith({
      contractAddress: "0xaa",
      entrypoint: "approve",
      calldata: CallData.compile({ spender: "0xb1", amount: { low: 3n, high: 1n << 52n } }),
    });
    expect(wait.mock.invocationCallOrder[0]).toBeLessThan(submit.mock.invocationCallOrder[0]);
    expect(decoded()).toEqual({ structure_id: 9n, resource_type: 2n, amount, client_fee_recipient: 0n });
  });
  it("submits a withdrawal without a token approval", async () => {
    const { calls, signer, decoded } = setup();
    await calls.bridge_withdraw_from_realm({
      signer,
      from_structure_id: 9,
      recipient_address: "0x456",
      client_fee_recipient: 0,
      resources: [{ resource_type: 2, tokenAddress: "0xaa", amount: 100n }],
    });
    expect(signer.execute).not.toHaveBeenCalled();
    expect(decoded()).toEqual({
      structure_id: 9n,
      resource_type: 2n,
      amount: 100n,
      recipient: 0x456n,
      client_fee_recipient: 0n,
    });
  });
});
