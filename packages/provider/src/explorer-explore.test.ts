import { describe, expect, it, vi } from "vitest";
import { EternumProvider, TransactionType } from "./index";

const makeProvider = () => {
  const provider = Object.create(EternumProvider.prototype) as any;
  provider.manifest = {
    world: { address: "0xworld" },
    contracts: [{ tag: "s1_eternum-troop_movement_systems", address: "0xmovement" }],
  };
  provider.VRF_PROVIDER_ADDRESS = "0xvrf";
  provider.promiseQueue = {
    enqueue: vi.fn().mockResolvedValue({ transaction_hash: "0xexplore" }),
  };
  return provider;
};

describe("EternumProvider.explorer_explore", () => {
  it("uses the combined explore and extract entrypoint to avoid the extra system call", async () => {
    const provider = makeProvider();
    const signer = { address: "0xabc" };

    await provider.explorer_explore({
      signer,
      explorer_id: 42,
      directions: [0],
      vrf_source_salt: "0xfeed",
    });

    expect(provider.promiseQueue.enqueue).toHaveBeenCalledWith({
      signer,
      transactionType: TransactionType.EXPLORE,
      calls: [
        {
          contractAddress: "0xvrf",
          entrypoint: "request_random",
          calldata: ["0xmovement", 1, "0xfeed"],
        },
        {
          contractAddress: "0xmovement",
          entrypoint: "explorer_explore_and_extract",
          calldata: [42, [0]],
        },
      ],
    });
  });
});
