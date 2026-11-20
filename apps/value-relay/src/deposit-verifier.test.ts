import { structureSnapshot } from "../test-support/deposit-structure";
import { beforeEach, expect, it, vi } from "vitest";
import { realmsAccountAddress } from "../../../packages/identity/src/account";
import { verifiedDepositHash } from "./deposit-verifier";
import {
  depositCommitment,
  deliveryHash,
  resolutionHash,
  principalHash,
  type LordsDeposit,
} from "@realms-world/value-ledger/deposits";
const rpc = vi.hoisted(() => ({ read: vi.fn(), snapshot: vi.fn() }));
vi.mock("@realms-world/value-ledger", async (original) => ({
  ...(await original<typeof import("@realms-world/value-ledger")>()),
  rpcAt: () => ({
    callContract: rpc.read,
    getChainId: async () => "0x2",
    getBlock: async () => ({ block_number: 10, block_hash: "0x10", timestamp: 1000, status: "ACCEPTED_ON_L2" }),
  }),
}));
vi.mock("./shard-snapshot", async (original) => ({
  ...(await original<typeof import("./shard-snapshot")>()),
  readConfirmedSnapshot: rpc.snapshot,
}));
vi.mock("./shard-rpc", () => ({
  ShardReader: class {
    async header() {
      return { timestamp: 1000 };
    }
  },
}));
const domain = { chainId: "0x1", ledger: "0x10", epoch: 2 };
const account = realmsAccountAddress("0x77", "0x11", "0x22");
const payment: LordsDeposit = {
  shard: "0x2",
  id: "1",
  gameId: 7,
  games: "0x20",
  account,
  realmsId: "0x77",
  home: "17",
  payer: "0x33",
  amount: "40",
  paidAt: "999",
  status: "pending",
};
const ledger = {
  assertCanonical: async () => {},
  head: { number: 50, hash: "0x50", time: 1000 },
  read: vi.fn(),
  deposit: vi.fn(),
  count: async () => 1n,
  principal: async () => null,
};
const context = {
  domain,
  publicKey: "0x44",
  payoutIdentity: vi.fn(async () => "0x77"),
  ledger,
  shard: {
    chainId: "0x2",
    rpcUrl: "http://127.0.0.1:8080",
    gamesAddress: "0x20",
    heraldUrl: "http://127.0.0.1:8081",
    firstRelease: 1,
  },
};
let cancelled = false,
  swept = true,
  realmsId = "0x77";
beforeEach(() => {
  vi.clearAllMocks();
  cancelled = false;
  swept = true;
  context.payoutIdentity.mockResolvedValue("0x77");
  realmsId = "0x77";
  ledger.read.mockResolvedValue(["0x20"]);
  ledger.deposit.mockResolvedValue(payment);
  rpc.snapshot.mockResolvedValue({
    confirmed_block: 10,
    game_id: "7",
    models: [
      { model: "DepositSource", rows: [{ value: { chain: "0x1", ledger: "0x10", signer: "0x44", epoch: 2 } }] },
      { model: "GameRegistry", rows: [{ value: { start_main_at: 1, scheduled_end_at: 2000, end_at: 2000 } }] },
      { model: "Structure", rows: [{ value: structureSnapshot(account) }] },
    ],
  });
  rpc.read.mockImplementation(async ({ entrypoint }) => {
    if (entrypoint === "authentication") return ["0x11", "0x22"];
    if (entrypoint === "realms_id") return [realmsId];
    if (entrypoint === "deposit_receipt")
      return ["0", depositCommitment(domain, payment), account, "40", cancelled ? "1" : "0"];
    if (entrypoint === "spend_lords") return swept ? ["0", "0", "40"] : ["40", "0", "0"];
    if (entrypoint === "principal_withdrawal") return swept ? ["0", "40"] : ["1"];
    throw new Error("unexpected read");
  });
});
it("signs only a confirmed L2 receipt bound to the configured root and verified beneficiary", async () => {
  const request = { kind: "deposit" as const, shard: "0x2", season: 7, id: "1", cancel: false };
  expect(await verifiedDepositHash(context, request)).toBe(deliveryHash(depositCommitment(domain, payment), 2, false));
  realmsId = "0x88";
  await expect(verifiedDepositHash(context, request)).rejects.toThrow("deposit_identity_differs");
  expect(await verifiedDepositHash(context, { ...request, cancel: true })).toBe(
    deliveryHash(depositCommitment(domain, payment), 2, true),
  );
  ledger.deposit.mockResolvedValue({ ...payment, games: "0x21" });
  await expect(verifiedDepositHash(context, request)).rejects.toThrow("target_differs");
});
it("derives the resolution from the confirmed L3 receipt, never the requested refund", async () => {
  const request = { kind: "resolve-deposit" as const, shard: "0x2", season: 7, id: "1" };
  expect(await verifiedDepositHash(context, request)).toBe(
    resolutionHash(domain, depositCommitment(domain, payment), false),
  );
  cancelled = true;
  expect(await verifiedDepositHash(context, request)).toBe(
    resolutionHash(domain, depositCommitment(domain, payment), true),
  );
  rpc.read.mockResolvedValue(["1"]);
  await expect(verifiedDepositHash(context, request)).rejects.toThrow("resolution_unconfirmed");
});
it("pays principal only after the existing sweep debits it and the payout wallet identity is verified", async () => {
  const payment = { kind: "principal" as const, shard: "0x2", season: 7, account, wallet: "0x88", amount: "40" };
  await expect(verifiedDepositHash(context, payment)).rejects.toThrow("principal_sweep_unconfirmed");
  const snapshot = await rpc.snapshot();
  snapshot.models.find((row: { model: string }) => row.model === "GameRegistry").rows[0].value.end_at = 1000;
  rpc.snapshot.mockResolvedValue(snapshot);
  expect(await verifiedDepositHash(context, payment)).toBe(principalHash(domain, "0x20", payment));
  expect(context.payoutIdentity).toHaveBeenCalledWith(account, "0x88");
  swept = false;
  await expect(verifiedDepositHash(context, payment)).rejects.toThrow("principal_sweep_unconfirmed");
  swept = true;
  await expect(verifiedDepositHash(context, { ...payment, amount: "41" })).rejects.toThrow(
    "principal_sweep_unconfirmed",
  );
  context.payoutIdentity.mockRejectedValue(new Error("payout_wallet_differs"));
  await expect(verifiedDepositHash(context, payment)).rejects.toThrow("payout_wallet_differs");
});
it("refuses a different ledger, signer epoch or unregistered target", async () => {
  const request = { kind: "deposit" as const, shard: "0x2", season: 7, id: "1", cancel: false };
  await expect(verifiedDepositHash({ ...context, domain: { ...domain, epoch: 3 } }, request)).rejects.toThrow(
    "source_differs",
  );
  await expect(verifiedDepositHash({ ...context, domain: { ...domain, ledger: "0x11" } }, request)).rejects.toThrow(
    "source_differs",
  );
  ledger.read.mockResolvedValue(["0x0"]);
  await expect(verifiedDepositHash(context, request)).rejects.toThrow("target_differs");
});

it("refuses malformed flat Structure evidence rather than treating a valid realm as a refund", async () => {
  const snapshot = await rpc.snapshot();
  snapshot.models.find((model: { model: string }) => model.model === "Structure").rows[0].value = {
    game_id: 7,
    entity_id: "17",
    owner: account,
    category: 1,
  };
  rpc.snapshot.mockResolvedValue(snapshot);
  await expect(
    verifiedDepositHash(context, { kind: "deposit", shard: "0x2", season: 7, id: "1", cancel: false }),
  ).rejects.toThrow("Unexpected fields in Structure");
});
