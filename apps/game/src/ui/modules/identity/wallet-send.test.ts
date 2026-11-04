import { outsideExecution, typedData, type AccountInterface, type ProviderInterface, type TypedData } from "starknet";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
const passkey = vi.hoisted(() => ({ sign: vi.fn(async () => ["0x4", "0x9"]) }));
vi.mock("./passkey", () => ({ signWithPasskey: passkey.sign }));

import { identityClient } from "@/hooks/context/identity-session";
import { L2_CHAIN } from "@/runtime/l2-rpc";

import { IdentityRequestError } from "@realms-world/identity";
import { forgetUncertain, uncertainSendOf, UncertainSendNotKeptError } from "./uncertain-sends";
import {
  prepareDefaultWalletSend,
  sendFromDefaultWallet,
  sendFromWallet,
  submitSigned,
  UnexpectedExecutionError,
  WrongWalletError,
} from "./wallet-send";

const CALLS = [{ contractAddress: "0x1ed9e7", entrypoint: "register", calldata: [] }];

const wallet = () => {
  const execute = vi.fn(async () => ({ transaction_hash: "0xtx" }));
  return { account: { address: "0x4a1", execute } as unknown as AccountInterface, execute };
};

const chain = (strk: bigint, receipt: Promise<object>) =>
  ({
    callContract: vi.fn(async () => [String(strk), "0"]),
    waitForTransaction: vi.fn(() => receipt),
  }) as unknown as ProviderInterface;

it("sends from the owner only, and offers the swap instead of sending when it holds no STRK for the fee", async () => {
  const { account, execute } = wallet();
  const landed = Promise.resolve({ isReverted: () => false });
  await expect(sendFromWallet(account, "0x999", CALLS, chain(1n, landed), vi.fn())).rejects.toBeInstanceOf(
    WrongWalletError,
  );
  const empty = chain(0n, landed);
  await expect(sendFromWallet(account, "0x4a1", CALLS, empty, vi.fn())).resolves.toEqual({ kind: "no-strk" });
  expect(execute).not.toHaveBeenCalled();
  // The fee balance is read on the network's own fee token, STRK, never on a token a service names.
  expect(empty.callContract).toHaveBeenCalledWith({
    contractAddress: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
    entrypoint: "balance_of",
    calldata: ["0x4a1"],
  });
});

it("holds a sent call until its receipt lands, and answers a revert with the ledger's own reason", async () => {
  const { account } = wallet();
  const signed = vi.fn();
  const landed = sendFromWallet(
    account,
    "0x04a1",
    CALLS,
    chain(1n, Promise.resolve({ isReverted: () => false })),
    signed,
  );
  await expect(landed).resolves.toEqual({ kind: "landed" });
  expect(signed).toHaveBeenCalledOnce();
  const reverted = {
    isReverted: () => true,
    revert_reason:
      "Error in the called contract (0x1ed9e7):\nExecution failed. Failure reason: 'Ledger: already registered'.",
  };
  await expect(sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.resolve(reverted)), vi.fn())).resolves.toEqual(
    {
      kind: "refused",
      reason: "Ledger: already registered",
    },
  );
});

it("says the network did not confirm a send whose receipt could not be read, never that it was not sent", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { account } = wallet();
  const outcome = await sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.reject(new Error("503"))), vi.fn());
  // Unconfirmed, never refused: a refused send would offer Try again, a second payment.
  expect(outcome).toEqual({ kind: "unconfirmed" });
});

const TRANSFER = { contractAddress: "0x124aeb", entrypoint: "transfer", calldata: ["0x5", "100", "0"] };
const WALLET = {
  address: "0x6c3d70a2d9197da8e24ee33ec8e26b00faccfaafe0fa9bd0003c0eb11397b4f",
  credentialId: "cred",
  publicKeyX: "0x1",
  origin: "https://realms.test",
  rpId: "realms.test",
};
/** The sponsor's outside execution of `calls` on `chainId`, as starknet.js builds it for execute_from_outside_v2. */
const built = (calls = [TRANSFER], chainId: string = L2_CHAIN.id) =>
  outsideExecution.getTypedData(
    chainId,
    { caller: "0x414e595f43414c4c4552", execute_after: 1, execute_before: 1_900_000_000 },
    "0x1",
    calls,
    "2",
  ) as unknown as Record<string, unknown>;

it("prepares the default wallet's send only when the sponsor built exactly the asked calls on this chain", async () => {
  const build = vi.spyOn(identityClient, "buildDefaultWalletCall");
  build.mockResolvedValueOnce(built());
  await expect(prepareDefaultWalletSend([TRANSFER])).resolves.toEqual(built());
  expect(build).toHaveBeenLastCalledWith([{ ...TRANSFER, calldata: ["0x5", "0x64", "0x0"] }]);
  for (const other of [
    built([TRANSFER, { ...TRANSFER, calldata: ["0xbad", "100", "0"] }]),
    built([{ ...TRANSFER, calldata: ["0xbad", "100", "0"] }]),
    built([{ ...TRANSFER, entrypoint: "approve" }]),
    built([TRANSFER], "0x534e5f5345504f4c4941"),
  ]) {
    build.mockResolvedValueOnce(other);
    await expect(prepareDefaultWalletSend([TRANSFER])).rejects.toBeInstanceOf(UnexpectedExecutionError);
  }
  build.mockRestore();
});

it("signs the prepared execution's hash with the passkey, sends it through the sponsor, and holds until it lands", async () => {
  const execution = built();
  const execute = vi.spyOn(identityClient, "executeDefaultWalletCall").mockResolvedValue("0xtx");
  const signed = vi.fn();
  const provider = chain(0n, Promise.resolve({ isReverted: () => false }));
  await expect(
    sendFromDefaultWallet(WALLET, execution as unknown as TypedData, "[]", provider, signed),
  ).resolves.toEqual({ kind: "landed" });
  // Landed: nothing is left uncertain.
  expect(uncertainSendOf(WALLET.address)).toBeUndefined();
  expect(passkey.sign).toHaveBeenCalledWith(
    WALLET,
    typedData.getMessageHash(execution as unknown as TypedData, WALLET.address),
  );
  expect(execute).toHaveBeenCalledWith(execution, ["0x4", "0x9"]);
  expect(signed).toHaveBeenCalledOnce();
  // The sponsor pays: no STRK is read.
  expect(provider.callContract).not.toHaveBeenCalled();
  expect(provider.waitForTransaction).toHaveBeenCalledWith("0xtx", expect.anything());
});

it("keeps a send whose sponsor answer was lost, and sends again only the same signed execution", async () => {
  forgetUncertain(WALLET.address);
  const execution = built();
  passkey.sign.mockClear();
  const execute = vi
    .spyOn(identityClient, "executeDefaultWalletCall")
    .mockRejectedValueOnce(new IdentityRequestError(503, "SEND_UNCERTAIN"))
    .mockResolvedValueOnce("0xsame");
  const provider = chain(0n, Promise.resolve({ isReverted: () => false }));
  await expect(
    sendFromDefaultWallet(WALLET, execution as unknown as TypedData, '["transfer"]', provider, vi.fn()),
  ).resolves.toEqual({ kind: "unconfirmed" });
  const kept = uncertainSendOf(WALLET.address);
  expect(kept).toMatchObject({
    via: "passkey",
    calls: '["transfer"]',
    execution,
    ownerSignature: ["0x4", "0x9"],
    hash: null,
  });
  // Re-entry sends the very same execution and signature: one nonce, so at most one transfer, and no new passkey prompt.
  await expect(
    submitSigned(kept as Extract<typeof kept, { via: "passkey" }>, provider, vi.fn(), "again"),
  ).resolves.toEqual({
    kind: "landed",
  });
  expect(execute.mock.calls).toEqual([
    [execution, ["0x4", "0x9"]],
    [execution, ["0x4", "0x9"]],
  ]);
  expect(passkey.sign).toHaveBeenCalledTimes(1);
  expect(uncertainSendOf(WALLET.address)).toBeUndefined();
  execute.mockRestore();
});

it("forgets a send the sponsor refused, proven never sent", async () => {
  forgetUncertain(WALLET.address);
  const execute = vi
    .spyOn(identityClient, "executeDefaultWalletCall")
    .mockRejectedValueOnce(new IdentityRequestError(502, "SPONSOR_REFUSED"));
  await expect(
    sendFromDefaultWallet(WALLET, built() as unknown as TypedData, "[]", chain(0n, Promise.resolve({})), vi.fn()),
  ).rejects.toBeInstanceOf(IdentityRequestError);
  expect(uncertainSendOf(WALLET.address)).toBeUndefined();
  execute.mockRestore();
});

it("never calls a send refused when its receipt cannot be read: it stays on its way, with its transaction", async () => {
  forgetUncertain(WALLET.address);
  forgetUncertain("0x4a1");
  const execute = vi.spyOn(identityClient, "executeDefaultWalletCall").mockResolvedValue("0xtx");
  const lostReceipt = () => chain(1n, Promise.reject(new Error("timeout")));
  await expect(
    sendFromDefaultWallet(WALLET, built() as unknown as TypedData, "[]", lostReceipt(), vi.fn()),
  ).resolves.toEqual({ kind: "unconfirmed" });
  expect(uncertainSendOf(WALLET.address)).toMatchObject({ via: "passkey", hash: "0xtx" });
  const { account } = wallet();
  await expect(sendFromWallet(account, "0x4a1", CALLS, lostReceipt(), vi.fn())).resolves.toEqual({
    kind: "unconfirmed",
  });
  expect(uncertainSendOf("0x4a1")).toMatchObject({ via: "wallet", hash: "0xtx", calls: JSON.stringify(CALLS) });
  execute.mockRestore();
});

it("keeps an uncertain send when its resubmission is refused: that refusal says nothing of the first", async () => {
  forgetUncertain(WALLET.address);
  const execute = vi
    .spyOn(identityClient, "executeDefaultWalletCall")
    .mockRejectedValueOnce(new IdentityRequestError(503, "SEND_UNCERTAIN"))
    .mockRejectedValueOnce(new IdentityRequestError(401, "unauthorized"));
  const provider = chain(0n, Promise.resolve({ isReverted: () => false }));
  await sendFromDefaultWallet(WALLET, built() as unknown as TypedData, "[]", provider, vi.fn());
  const kept = uncertainSendOf(WALLET.address)!;
  await expect(
    submitSigned(kept as Extract<typeof kept, { via: "passkey" }>, provider, vi.fn(), "again"),
  ).rejects.toBeInstanceOf(IdentityRequestError);
  // Still uncertain: no new transfer is offered until the chain settles the first.
  expect(uncertainSendOf(WALLET.address)).toEqual(kept);
  execute.mockRestore();
});

it("sends nothing when this browser cannot keep the record, on either path", async () => {
  forgetUncertain(WALLET.address);
  forgetUncertain("0x4a1");
  const full = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("quota", "QuotaExceededError");
  });
  const execute = vi.spyOn(identityClient, "executeDefaultWalletCall");
  await expect(
    sendFromDefaultWallet(WALLET, built() as unknown as TypedData, "[]", chain(0n, Promise.resolve({})), vi.fn()),
  ).rejects.toBeInstanceOf(UncertainSendNotKeptError);
  expect(execute).not.toHaveBeenCalled();
  const { account, execute: walletExecute } = wallet();
  await expect(
    sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.resolve({ isReverted: () => false })), vi.fn()),
  ).rejects.toBeInstanceOf(UncertainSendNotKeptError);
  expect(walletExecute).not.toHaveBeenCalled();
  full.mockRestore();
  execute.mockRestore();
});

it("keeps a connected wallet's send whose answer was lost, and forgets only the wallet's own refusal", async () => {
  forgetUncertain("0x4a1");
  const lost = { address: "0x4a1", execute: vi.fn(async () => Promise.reject(new Error("connection lost"))) };
  await expect(
    sendFromWallet(lost as unknown as AccountInterface, "0x4a1", CALLS, chain(1n, Promise.resolve({})), vi.fn()),
  ).resolves.toEqual({ kind: "unconfirmed" });
  // Accepted perhaps, its hash never known: kept, so re-entry offers no new transfer.
  expect(uncertainSendOf("0x4a1")).toMatchObject({ via: "wallet", hash: null, calls: JSON.stringify(CALLS) });
  forgetUncertain("0x4a1");
  const declined = {
    address: "0x4a1",
    execute: vi.fn(async () => Promise.reject({ code: 113, message: "USER_REFUSED_OP" })),
  };
  await expect(
    sendFromWallet(declined as unknown as AccountInterface, "0x4a1", CALLS, chain(1n, Promise.resolve({})), vi.fn()),
  ).rejects.toMatchObject({ code: 113 });
  expect(uncertainSendOf("0x4a1")).toBeUndefined();
});
