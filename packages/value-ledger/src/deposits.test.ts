import { describe, it, expect } from "vitest";
import {
  depositCalls,
  decodeLordsDeposit,
  depositCommitment,
  deliveryHash,
  resolutionHash,
  principalHash,
  decodeDepositSigningRequest,
  wholeLords,
} from "./deposits";
const domain = { chainId: "0x534e5f54455354", ledger: "0x123", epoch: 2 };
const fields = ["1", "0x456", "0x789", "0xabc", "17", "0x111", "40", "1000", "0"];
const receipt = decodeLordsDeposit("0x222", "1", fields);
describe("spend-only LORDS receipt", () => {
  it("decodes whole units and refuses fractional, overflow, absent and malformed records", () => {
    expect(receipt).toEqual({
      shard: "0x222",
      id: "1",
      gameId: 1,
      games: "0x456",
      account: "0x789",
      realmsId: "0xabc",
      home: "17",
      payer: "0x111",
      amount: "40",
      paidAt: "1000",
      status: "pending",
    });
    for (const amount of ["0", "1.2", "-1", "1e3", " 1", String(2n ** 128n)])
      expect(() => wholeLords(amount)).toThrow();
    for (const row of [fields.slice(1), [...fields, "0"], fields.map(() => "0"), [...fields.slice(0, 8), "3"]])
      expect(() => decodeLordsDeposit("0x222", "1", row)).toThrow();
    expect(wholeLords("9007199254740993")).toBe(9007199254740993n);
  });
  it("binds every receipt dimension, including distinct deposits in one transaction", () => {
    const commitment = depositCommitment(domain, receipt);
    for (const field of [
      "shard",
      "id",
      "gameId",
      "games",
      "account",
      "realmsId",
      "home",
      "payer",
      "amount",
      "paidAt",
    ] as const)
      expect(depositCommitment(domain, { ...receipt, [field]: field === "gameId" ? 2 : "999" })).not.toBe(commitment);
    expect(depositCommitment({ ...domain, chainId: "0x333" }, receipt)).not.toBe(commitment);
    expect(depositCommitment({ ...domain, ledger: "0x333" }, receipt)).not.toBe(commitment);
    expect(depositCommitment(domain, { ...receipt, status: "delivered" })).toBe(commitment);
    expect(deliveryHash(commitment, 2, false)).not.toBe(deliveryHash(commitment, 2, true));
    expect(deliveryHash(commitment, 2, false)).not.toBe(deliveryHash(commitment, 3, false));
    expect(resolutionHash(domain, commitment, false)).not.toBe(resolutionHash(domain, commitment, true));
  });
  it("approves exactly whole LORDS and binds a retry request to the wallet call", () => {
    const calls = depositCalls(domain.ledger, "0x999", receipt, "40", "0x10");
    expect(calls).toEqual([
      { contractAddress: "0x999", entrypoint: "approve", calldata: ["0x123", "40000000000000000000", "0"] },
      {
        contractAddress: "0x123",
        entrypoint: "deposit_lords",
        calldata: ["0x222", "1", "0x789", "0xabc", "17", "40", "0x10"],
      },
    ]);
  });
  it("principal signatures bind wallet, source and amount independently of submitting operator", () => {
    const payment = {
      kind: "principal" as const,
      shard: "0x222",
      season: 1,
      account: "0x789",
      wallet: "0xabc",
      amount: "40",
    };
    const hash = principalHash(domain, "0x456", payment);
    for (const field of ["shard", "account", "wallet", "amount"] as const)
      expect(principalHash(domain, "0x456", { ...payment, [field]: "999" })).not.toBe(hash);
    expect(principalHash(domain, "0x457", payment)).not.toBe(hash);
    expect(principalHash({ ...domain, epoch: 3 }, "0x456", payment)).not.toBe(hash);
    expect(() => decodeDepositSigningRequest({ ...payment, caller: "0x123" })).toThrow();
    expect(decodeDepositSigningRequest(payment)).toEqual(payment);
    expect(() =>
      decodeDepositSigningRequest({ kind: "deposit", shard: "0x222", season: 1, id: "1", digest: "0x123" }),
    ).toThrow();
  });
});

it("pins every custody read to the hash and refuses regression, replacement and mid-read reorg", async () => {
  const { depositReader } = await import("./deposits");
  const { vi } = await import("vitest");
  const provider = {
    getChainId: async () => domain.chainId,
    getBlock: vi.fn(async () => ({ block_number: 10, block_hash: "0xa", timestamp: 1000, status: "ACCEPTED_ON_L2" })),
    callContract: vi.fn(async () => fields),
  };
  const rpc = provider as unknown as import("starknet").RpcProvider;
  const reader = await depositReader(rpc, domain.ledger, domain.chainId, { number: 10, hash: "0xa" });
  expect(await reader.deposit("0x222", "1")).toEqual(receipt);
  expect(provider.callContract).toHaveBeenCalledWith(
    { contractAddress: domain.ledger, entrypoint: "get_deposit", calldata: ["0x222", "1"] },
    "0xa",
  );
  await expect(depositReader(rpc, domain.ledger, domain.chainId, { number: 11, hash: "0xb" })).rejects.toThrow(
    "regressed",
  );
  await expect(depositReader(rpc, domain.ledger, domain.chainId, { number: 10, hash: "0xb" })).rejects.toThrow(
    "rewritten",
  );
  provider.getBlock.mockResolvedValue({
    block_number: 10,
    block_hash: "0xb",
    timestamp: 1000,
    status: "ACCEPTED_ON_L2",
  });
  await expect(reader.assertCanonical()).rejects.toThrow("rewritten");
});

/** A ledger whose head can be replaced: blocks above `final` are not yet accepted by Ethereum. */
const simulatedChain = (head: number, final: number, hashes: Record<number, string>) => {
  const block = (number: number, status: string) => ({
    block_number: number,
    block_hash: hashes[number]!,
    timestamp: 1000 + number,
    status,
  });
  return {
    getChainId: async () => domain.chainId,
    getBlock: async (id: number | string) =>
      id === "latest"
        ? block(head, "ACCEPTED_ON_L2")
        : id === "l1_accepted"
          ? block(final, "ACCEPTED_ON_L1")
          : block(id as number, (id as number) <= final ? "ACCEPTED_ON_L1" : "ACCEPTED_ON_L2"),
    callContract: async () => fields,
  } as unknown as import("starknet").RpcProvider;
};
describe("a stored deposit anchor after the chain replaced its block", () => {
  const stored = { number: 12, hash: "0xa1" };
  it("keeps an anchor that still stands", async () => {
    const { depositReader } = await import("./deposits");
    const reader = await depositReader(
      simulatedChain(14, 10, { 10: "0x10", 12: "0xa1", 14: "0x14" }),
      domain.ledger,
      domain.chainId,
      stored,
    );
    expect(reader.head.number).toBe(14);
  });
  it.each([
    ["rewritten", 14, { 10: "0x10", 12: "0xb2", 14: "0x14" }],
    ["regressed", 11, { 10: "0x10", 11: "0x11", 12: "0xa1" }],
  ])(
    "drops an anchor that was %s before Ethereum accepted it, and reads the canonical chain",
    async (_, head, hashes) => {
      const { depositReader } = await import("./deposits");
      const reader = await depositReader(simulatedChain(head, 10, hashes), domain.ledger, domain.chainId, stored);
      expect(reader.head.number).toBe(head);
      expect(await reader.deposit("0x222", "1")).toEqual(receipt);
    },
  );
  it("still refuses an anchor whose block Ethereum had accepted", async () => {
    const { depositReader } = await import("./deposits");
    await expect(
      depositReader(simulatedChain(14, 12, { 12: "0xb2", 14: "0x14" }), domain.ledger, domain.chainId, stored),
    ).rejects.toThrow("rewritten");
  });
});
