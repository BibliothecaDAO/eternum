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
    await calls.bitcoin_mine_contribute_labor({ signer, mine_id: 9, target_phase_id: 2n, labor_amount: labor });
    const queued = enqueue.mock.calls[0][0];
    expect(queued.transactionType).toBe(TransactionType.BITCOIN_MINE_CONTRIBUTE_LABOR);
    expect(scoped(provider, queued.calls)).toEqual({
      contractAddress: MINE,
      entrypoint: "contribute_labor",
      calldata: ["7", 9, 2n, labor],
    });
  });

  it.each(["0x0", "0x99"])("claims a phase with the configured VRF (%s)", async (vrf) => {
    const { provider, enqueue, calls } = setup(vrf);
    await calls.bitcoin_mine_claim_phase_reward({ signer, phase_id: 2n, mine_ids: [9, 10] });
    const queued = enqueue.mock.calls[0][0];
    const actual = scoped(provider, queued.calls) as Call[];
    expect(queued.transactionType).toBe(TransactionType.BITCOIN_MINE_CLAIM_PHASE_REWARD);
    expect(actual.at(-1)).toEqual({
      contractAddress: MINE,
      entrypoint: "claim_phase_reward",
      calldata: ["7", 2n, 2, 9, 10],
    });
    expect(actual).toHaveLength(vrf === "0x0" ? 1 : 2);
    if (vrf !== "0x0")
      expect(actual[0]).toEqual({
        contractAddress: vrf,
        entrypoint: "request_random",
        calldata: [MINE, 0, signer.address],
      });
  });

  it("rejects unsigned mine actions before enqueueing", async () => {
    const { enqueue, calls } = setup();
    const unsigned = { address: "0x0" } as AccountInterface;
    await expect(
      calls.bitcoin_mine_contribute_labor({ signer: unsigned, mine_id: 9, target_phase_id: 2, labor_amount: 100 }),
    ).rejects.toThrow("No account connected");
    await expect(
      calls.bitcoin_mine_claim_phase_reward({ signer: unsigned, phase_id: 2, mine_ids: [9] }),
    ).rejects.toThrow("No account connected");
    expect(enqueue).not.toHaveBeenCalled();
  });
});
