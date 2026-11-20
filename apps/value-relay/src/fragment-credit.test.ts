import { expect, it, vi } from "vitest";
import { CallData, hash } from "starknet";
import { gamesAbi } from "../../../packages/value-ledger/test-support/abi";
import { creditFriendFragments } from "./fragment-credit";

const admin = vi.hoisted(() => vi.fn());
vi.mock("@realms-world/value-ledger/shard", () => ({
  ShardOperator: class {
    admin = admin;
  },
}));

const target = (account: string | null) => ({
  connection: { chainId: "0x1", gamesAddress: "0x10", rpcUrl: "https://shard.test/rpc", firstRelease: 1 },
  operatorAddress: "0x20",
  privateKey: "0x1",
  identity: { accountForRealmsId: async () => account },
});
const credit = { chainId: "0x1", gameId: 7, realmsId: "0x2", id: "friend:0x1:7:0xabc", amount: 100 };

it("credits the sharer's account under the payout's own id as a friend's Fragments, the same id on every retry", async () => {
  admin.mockImplementation(async (method: string, args: never) => void new CallData(gamesAbi).compile(method, args));
  await creditFriendFragments(target("0x123"), credit);
  await creditFriendFragments(target("0x123"), credit);
  const sent = {
    game_id: 7,
    credit: {
      id: hash.starknetKeccak(credit.id).toString(),
      account: "0x123",
      amount: 100,
    },
  };
  expect(admin.mock.calls).toEqual([
    ["credit_fragments", sent],
    ["credit_fragments", sent],
  ]);
});

it("asks for a retry when the chain refuses the credit, and credits nothing for an unknown account or another chain", async () => {
  admin.mockReset().mockRejectedValue(new Error("reverted"));
  await expect(creditFriendFragments(target("0x123"), credit)).rejects.toMatchObject({
    status: 503,
    code: "fragment_credit_unavailable",
  });
  admin.mockReset();
  await expect(creditFriendFragments(target(null), credit)).rejects.toMatchObject({ code: "account_unavailable" });
  await expect(creditFriendFragments(target("0x123"), { ...credit, chainId: "0x2" })).rejects.toMatchObject({
    code: "shard_chain_differs",
  });
  expect(admin).not.toHaveBeenCalled();
});
