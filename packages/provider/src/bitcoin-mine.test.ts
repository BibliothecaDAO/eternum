import type { AccountInterface, Abi, Call } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { createSystemCalls } from "@bibliothecadao/types";
import bindings from "../../../contracts/l3/world-native/schema/bindings.json";
import { EternumProvider, TransactionType } from "./index";
const signer = { address: "0x123" } as AccountInterface;
function setup() {
  const provider = new EternumProvider(
    { native: { version: 1 }, world: { address: "0x77" }, contracts: [] } as any,
    "http://127.0.0.1:1",
    undefined,
    { gameId: 7 },
  );
  provider.setNativeSubmission(vi.fn(), bindings.commandAbi as Abi, () => 9);
  const enqueue = vi
    .spyOn(provider.promiseQueue, "enqueue")
    .mockResolvedValue({ transaction_hash: "0x55", batch_remaining: "0" } as any);
  return { enqueue, calls: createSystemCalls({ provider }) };
}
const call = (enqueue: ReturnType<typeof setup>["enqueue"], index = 0) => enqueue.mock.calls[index][0].calls as Call;
describe("bitcoin mine commands", () => {
  it("encodes labor losslessly with one game scope", async () => {
    const { enqueue, calls } = setup();
    const labor = (1n << 100n) + 17n;
    await calls.bitcoin_mine_contribute_labor({ signer, structure_id: 9, labor_amount: labor });
    expect(enqueue.mock.calls[0][0].transactionType).toBe(TransactionType.BITCOIN_MINE_CONTRIBUTE_LABOR);
    expect(call(enqueue)).toMatchObject({ contractAddress: "0x77", entrypoint: "ContributeBitcoinLabor" });
    expect(call(enqueue).calldata?.slice(2)).toEqual(["9", String(labor)]);
    expect(call(enqueue).calldata?.[0]).toBe("7");
  });
  it("claims a phase and mine list as one command", async () => {
    const { enqueue, calls } = setup();
    await calls.bitcoin_mine_claim_phase_reward({ signer, phase_id: 2n, mine_ids: [9, 10] });
    expect(call(enqueue).entrypoint).toBe("ClaimBitcoinPhase");
    expect(call(enqueue).calldata?.slice(2)).toEqual(["2", "2", "9", "10"]);
  });
  it("closes before binding the phase", async () => {
    const { enqueue, calls } = setup();
    await calls.bitcoin_mine_close_phase({ signer, phase_id: 2 });
    await calls.bitcoin_mine_bind_phase({ signer, phase_id: 2 });
    expect([call(enqueue).entrypoint, call(enqueue, 1).entrypoint]).toEqual(["CloseBitcoinPhase", "BindBitcoinPhase"]);
  });
  it("rejects unsigned actions before queueing", async () => {
    const { enqueue, calls } = setup();
    await expect(
      calls.bitcoin_mine_contribute_labor({
        signer: { address: "0x0" } as AccountInterface,
        structure_id: 9,
        labor_amount: 100,
      }),
    ).rejects.toThrow("No account connected");
    expect(enqueue).not.toHaveBeenCalled();
  });
});
