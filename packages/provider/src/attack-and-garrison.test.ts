import { describe, expect, it, vi } from "vitest";
import { EternumProvider, NAMESPACE } from "./index";
import { TransactionType } from "./types";

const signer = { address: "0xabc" } as any;

const makeProvider = () => {
  const provider = Object.create(EternumProvider.prototype) as any;
  provider.manifest = {
    contracts: [
      { tag: `${NAMESPACE}-troop_battle_systems`, address: "0xbattle" },
      { tag: `${NAMESPACE}-resource_systems`, address: "0xresource" },
      { tag: `${NAMESPACE}-troop_management_systems`, address: "0xtroop" },
    ],
  };
  provider.promiseQueue = {
    enqueue: vi.fn().mockResolvedValue({ transaction_hash: "0xtx" }),
  };
  return provider;
};

describe("EternumProvider.attack_explorer_vs_guard_and_garrison", () => {
  it("submits attack then garrison calls in one queued transaction", async () => {
    const provider = makeProvider();

    await provider.attack_explorer_vs_guard_and_garrison({
      signer,
      explorer_id: 11,
      structure_id: 22,
      structure_direction: 3,
      to_guard_slot: 1,
      count: 400,
    });

    expect(provider.promiseQueue.enqueue).toHaveBeenCalledWith({
      signer,
      calls: [
        {
          contractAddress: "0xbattle",
          entrypoint: "attack_explorer_vs_guard",
          calldata: [11, 22, 3],
        },
        {
          contractAddress: "0xtroop",
          entrypoint: "explorer_guard_swap",
          calldata: [11, 22, 3, 1, 400],
        },
      ],
      transactionType: TransactionType.ATTACK_EXPLORER_VS_GUARD_AND_GARRISON,
    });
  });

  it("preserves resources before garrisoning when resources are provided", async () => {
    const provider = makeProvider();

    await provider.attack_explorer_vs_guard_and_garrison({
      signer,
      explorer_id: 11,
      structure_id: 22,
      structure_direction: 3,
      to_guard_slot: 1,
      count: 400,
      resources: [
        { resourceId: 101, amount: 5 },
        { resourceId: 102, amount: 9 },
      ],
    });

    expect(provider.promiseQueue.enqueue).toHaveBeenCalledWith({
      signer,
      calls: [
        {
          contractAddress: "0xbattle",
          entrypoint: "attack_explorer_vs_guard",
          calldata: [11, 22, 3],
        },
        {
          contractAddress: "0xresource",
          entrypoint: "troop_structure_adjacent_transfer",
          calldata: [11, 22, 2, 101, 5, 102, 9],
        },
        {
          contractAddress: "0xtroop",
          entrypoint: "explorer_guard_swap",
          calldata: [11, 22, 3, 1, 400],
        },
      ],
      transactionType: TransactionType.ATTACK_EXPLORER_VS_GUARD_AND_GARRISON,
    });
  });
});
