import type { AccountInterface, Call } from "starknet";
import { describe, expect, it, vi } from "vitest";
import { createSystemCalls } from "@bibliothecadao/types";
import { EternumProvider, TransactionType } from "./index";

const MINE = "0xa1";
const signer = { address: "0x123" } as AccountInterface;
const manifest = {
  world: { address: "0x77", abi: [{ type: "interface", name: "IWorld", items: [] }] },
  contracts: [{ address: MINE, tag: "s2-bitcoin_mine_systems", abi: [] }],
} as any;

function setup(vrf = "0x0") {
  const provider = new EternumProvider(manifest, "http://127.0.0.1:1", vrf, undefined, { namespace: "s2", gameId: 7 });
  const enqueue = vi.spyOn(provider.promiseQueue, "enqueue").mockResolvedValue({ transaction_hash: "0x55" } as any);
  return { provider, enqueue, calls: createSystemCalls({ provider }) };
}

const scoped = (provider: EternumProvider, calls: Call | Call[]) => (provider as any).withGameIdCalldata(calls);

describe("bitcoin mine calls", () => {
  it("routes authenticated labor through the queue with lossless u128 calldata and one game id", async () => {
    const { provider, enqueue, calls } = setup();
    const labor = (1n << 100n) + 17n;
    await calls.bitcoin_mine_contribute_labor({ signer, structure_id: 9, labor_amount: labor });
    const queued = enqueue.mock.calls[0][0];
    expect(queued.transactionType).toBe(TransactionType.BITCOIN_MINE_CONTRIBUTE_LABOR);
    expect(scoped(provider, queued.calls)).toEqual({
      contractAddress: MINE,
      entrypoint: "contribute_labor",
      calldata: ["7", 9, labor],
    });
  });

  it("claims from the bound phase without requesting a new draw", async () => {
    const { provider, enqueue, calls } = setup();
    await calls.bitcoin_mine_claim_phase_reward({ signer, phase_id: 2n, mine_ids: [9, 10] });
    expect(scoped(provider, enqueue.mock.calls[0][0].calls)).toEqual({
      contractAddress: MINE,
      entrypoint: "claim_phase_reward",
      calldata: ["7", 2n, 2, 9, 10],
    });
  });

  it("closes the pool before binding the recorded phase root", async () => {
    const { provider, enqueue, calls } = setup();
    await calls.bitcoin_mine_close_phase({ signer, phase_id: 2n });
    await calls.bitcoin_mine_bind_phase({ signer, phase_id: 2n });
    expect(enqueue.mock.calls.map(([queued]) => scoped(provider, queued.calls))).toEqual([
      { contractAddress: MINE, entrypoint: "close_bitcoin_phase", calldata: ["7", 2n] },
      { contractAddress: MINE, entrypoint: "bind_bitcoin_phase", calldata: ["7", 2n] },
    ]);
  });

  it("rejects unsigned mine actions before enqueueing", async () => {
    const { enqueue, calls } = setup();
    const unsigned = { address: "0x0" } as AccountInterface;
    await expect(
      calls.bitcoin_mine_contribute_labor({ signer: unsigned, structure_id: 9, labor_amount: 100 }),
    ).rejects.toThrow("No account connected");
    await expect(
      calls.bitcoin_mine_claim_phase_reward({ signer: unsigned, phase_id: 2, mine_ids: [9] }),
    ).rejects.toThrow("No account connected");
    expect(enqueue).not.toHaveBeenCalled();
  });
});
