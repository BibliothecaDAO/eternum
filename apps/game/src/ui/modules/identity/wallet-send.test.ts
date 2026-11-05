import { outsideExecution, typedData, type AccountInterface, type ProviderInterface, type TypedData } from "starknet";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
const passkey = vi.hoisted(() => ({ sign: vi.fn(async () => ["0x4", "0x9"]) }));
vi.mock("./passkey", () => ({ signWithPasskey: passkey.sign }));

import { identityClient } from "@/hooks/context/identity-session";
import { L2_CHAIN } from "@/runtime/l2-rpc";

import { IdentityRequestError } from "@realms-world/identity";
import { WALLET_GAS_TOKEN } from "@realms-world/identity/wallet";
import { forgetUncertain, uncertainSendOf, UncertainSendNotKeptError, type SignedPasskeySend } from "./uncertain-sends";
import {
  prepareDefaultWalletSend,
  sendFromDefaultWallet,
  sendFromWallet,
  submitSigned,
  UnexpectedExecutionError,
  WrongWalletError,
} from "./wallet-send";

const CALLS = [{ contractAddress: "0x1ed9e7", entrypoint: "register", calldata: [] }];

const wallet = (fee = 1n) => {
  const execute = vi.fn(async () => ({ transaction_hash: "0xtx" }));
  return {
    account: {
      address: "0x4a1",
      execute,
      estimateInvokeFee: vi.fn(async () => ({ overall_fee: fee })),
    } as unknown as AccountInterface,
    execute,
  };
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
/** AVNU's forwarder: the caller of every execution it builds, and where a wallet's fee goes. */
const FORWARDER = "0x127021a1b5a52d3174c2ab077c2b043c80369250d29428cee956d76ee51584f";
/** The paymaster's outside execution of `calls` on `chainId`, as starknet.js builds it for execute_from_outside_v2. */
const built = (calls = [TRANSFER], chainId: string = L2_CHAIN.id) =>
  outsideExecution.getTypedData(
    chainId,
    { caller: FORWARDER, execute_after: 1, execute_before: 1_900_000_000 },
    "0x1",
    calls,
    "2",
  ) as unknown as Record<string, unknown>;
/** The wallet's fee as AVNU's gasless mode adds it: a transfer of LORDS to its forwarder, the execution's last call. */
const feeCall = (amount: bigint, to = FORWARDER, token = WALLET_GAS_TOKEN) => ({
  contractAddress: token,
  entrypoint: "transfer",
  calldata: [to, `0x${amount.toString(16)}`, "0x0"],
});
const FEE = { estimated: "0x6d5e1a3a2b8c0000", max: "0x7e4a18b6f2a40000" };
const MAX = BigInt(FEE.max);

it("prepares a default wallet's send only as the asked calls on this chain, then its fee in LORDS within the max shown", async () => {
  const build = vi.spyOn(identityClient, "buildDefaultWalletCall");
  const paying = built([TRANSFER, feeCall(MAX)]);
  build.mockResolvedValueOnce({ typedData: paying, fee: FEE });
  await expect(prepareDefaultWalletSend([TRANSFER])).resolves.toEqual({
    execution: paying,
    fee: { estimated: BigInt(FEE.estimated), max: MAX },
  });
  expect(build).toHaveBeenLastCalledWith([{ ...TRANSFER, calldata: ["0x5", "0x64", "0x0"] }]);
  for (const other of [
    built([TRANSFER, feeCall(MAX + 1n)]),
    built([TRANSFER, feeCall(MAX, "0xbad")]),
    built([TRANSFER, feeCall(MAX, FORWARDER, "0x4718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d")]),
    built([TRANSFER]),
    built([feeCall(MAX), TRANSFER]),
    built([TRANSFER, { ...TRANSFER, calldata: ["0xbad", "100", "0"] }, feeCall(MAX)]),
    built([{ ...TRANSFER, calldata: ["0xbad", "100", "0"] }, feeCall(MAX)]),
    built([{ ...TRANSFER, entrypoint: "approve" }, feeCall(MAX)]),
    built([TRANSFER, feeCall(MAX)], "0x534e5f5345504f4c4941"),
  ]) {
    build.mockResolvedValueOnce({ typedData: other, fee: FEE });
    await expect(prepareDefaultWalletSend([TRANSFER])).rejects.toBeInstanceOf(UnexpectedExecutionError);
  }
  build.mockRestore();
});

it("prepares a sponsored step (a recovery's cancel) only as its call alone, with no fee", async () => {
  const cancel = { contractAddress: WALLET.address, entrypoint: "cancel_escape", calldata: [] };
  const build = vi.spyOn(identityClient, "buildDefaultWalletCall");
  build.mockResolvedValueOnce({ typedData: built([cancel]), fee: null });
  await expect(prepareDefaultWalletSend([cancel])).resolves.toEqual({ execution: built([cancel]), fee: null });
  build.mockResolvedValueOnce({ typedData: built([cancel, feeCall(1n)]), fee: null });
  await expect(prepareDefaultWalletSend([cancel])).rejects.toBeInstanceOf(UnexpectedExecutionError);
  build.mockRestore();
});

it("signs the prepared execution's hash with the passkey, sends it through the paymaster, and holds until it lands", async () => {
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
  // The wallet pays its fee in LORDS, inside the execution: no STRK is read.
  expect(provider.callContract).not.toHaveBeenCalled();
  expect(provider.waitForTransaction).toHaveBeenCalledWith("0xtx", expect.anything());
});

it("keeps a default wallet's send from the moment its passkey is asked, and forgets it once the passkey signs nothing", async () => {
  forgetUncertain(WALLET.address);
  const execution = built();
  const execute = vi.spyOn(identityClient, "executeDefaultWalletCall").mockResolvedValue("0xtx");
  let answer!: { sign: (signature: string[]) => void; decline: (error: Error) => void };
  passkey.sign.mockImplementationOnce(
    () => new Promise((sign, decline) => (answer = { sign, decline })) as Promise<string[]>,
  );
  const provider = chain(0n, Promise.resolve({ isReverted: () => false }));
  const late = sendFromDefaultWallet(WALLET, execution as unknown as TypedData, '["deposit"]', provider, vi.fn());
  // Asked, not answered: kept, so no other send from this wallet goes while this one may still be signed and sent.
  expect(uncertainSendOf(WALLET.address)).toMatchObject({
    via: "passkey",
    calls: '["deposit"]',
    execution,
    ownerSignature: null,
    hash: null,
  });
  answer.sign(["0x4", "0x9"]);
  await expect(late).resolves.toEqual({ kind: "landed" });
  expect(execute).toHaveBeenCalledWith(execution, ["0x4", "0x9"]);
  expect(uncertainSendOf(WALLET.address)).toBeUndefined();

  passkey.sign.mockImplementationOnce(
    () => new Promise((sign, decline) => (answer = { sign, decline })) as Promise<string[]>,
  );
  const declined = sendFromDefaultWallet(WALLET, execution as unknown as TypedData, "[]", provider, vi.fn());
  expect(uncertainSendOf(WALLET.address)).toMatchObject({ ownerSignature: null });
  const cause = new DOMException("The operation either timed out or was not allowed.", "NotAllowedError");
  answer.decline(cause);
  await expect(declined).rejects.toBe(cause);
  expect(uncertainSendOf(WALLET.address)).toBeUndefined();
  expect(execute).toHaveBeenCalledOnce();
  execute.mockRestore();
});

it("keeps a send whose paymaster answer was lost, and sends again only the same signed execution", async () => {
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
  await expect(submitSigned(kept as SignedPasskeySend, provider, vi.fn(), "again")).resolves.toEqual({
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

it("forgets a send the paymaster refused, proven never sent", async () => {
  forgetUncertain(WALLET.address);
  const execute = vi
    .spyOn(identityClient, "executeDefaultWalletCall")
    .mockRejectedValueOnce(new IdentityRequestError(502, "PAYMASTER_REFUSED"));
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
  await expect(submitSigned(kept as SignedPasskeySend, provider, vi.fn(), "again")).rejects.toBeInstanceOf(
    IdentityRequestError,
  );
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
  passkey.sign.mockClear();
  await expect(
    sendFromDefaultWallet(WALLET, built() as unknown as TypedData, "[]", chain(0n, Promise.resolve({})), vi.fn()),
  ).rejects.toBeInstanceOf(UncertainSendNotKeptError);
  expect(passkey.sign).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
  const { account, execute: walletExecute } = wallet();
  await expect(
    sendFromWallet(account, "0x4a1", CALLS, chain(1n, Promise.resolve({ isReverted: () => false })), vi.fn()),
  ).rejects.toBeInstanceOf(UncertainSendNotKeptError);
  expect(walletExecute).not.toHaveBeenCalled();
  full.mockRestore();
  execute.mockRestore();
});

it.each([
  new Error("connection lost"),
  new Error("User abort: response lost"),
  { code: 4001 },
  { code: "113" },
  undefined,
])("keeps a connected wallet's send whose answer was lost or unknown: %s", async (error) => {
  forgetUncertain("0x4a1");
  const { account, execute } = wallet();
  const provider = chain(1n, Promise.resolve({}));
  const signed = vi.fn();
  execute.mockRejectedValueOnce(error);
  await expect(sendFromWallet(account, "0x4a1", CALLS, provider, signed)).resolves.toEqual({ kind: "unconfirmed" });
  // Accepted perhaps, its hash never known: kept, so re-entry offers no new transfer.
  expect(uncertainSendOf("0x4a1")).toMatchObject({ via: "wallet", hash: null, calls: JSON.stringify(CALLS) });
  expect(signed).not.toHaveBeenCalled();
  expect(provider.waitForTransaction).not.toHaveBeenCalled();
});

it.each([
  { code: 113, message: "USER_REFUSED_OP" },
  Object.assign(new Error("User rejected"), { name: "UserRejectedRequestError" }),
  new Error("User abort"),
])("forgets only the supported wallet's own refusal, and passes it on: %s", async (error) => {
  forgetUncertain("0x4a1");
  const { account, execute } = wallet();
  const provider = chain(1n, Promise.resolve({}));
  execute.mockRejectedValueOnce(error);
  await expect(sendFromWallet(account, "0x4a1", CALLS, provider, vi.fn())).rejects.toBe(error);
  expect(uncertainSendOf("0x4a1")).toBeUndefined();
  expect(provider.waitForTransaction).not.toHaveBeenCalled();
});

it("prices the call first: a balance below the estimated fee offers the swap, and a revert is refused unsent", async () => {
  forgetUncertain("0x4a1");
  const short = wallet(2n);
  const provider = chain(1n, Promise.resolve({ isReverted: () => false }));
  await expect(sendFromWallet(short.account, "0x4a1", CALLS, provider, vi.fn())).resolves.toEqual({ kind: "no-strk" });
  expect(short.account.estimateInvokeFee).toHaveBeenCalledWith(CALLS);
  const reverting = wallet();
  vi.mocked(reverting.account.estimateInvokeFee).mockRejectedValueOnce(new Error("Ledger: deposits paused"));
  await expect(sendFromWallet(reverting.account, "0x4a1", CALLS, provider, vi.fn())).resolves.toEqual({
    kind: "refused",
    reason: "Ledger: deposits paused",
  });
  for (const unsent of [short, reverting]) expect(unsent.execute).not.toHaveBeenCalled();
  // Nothing was handed to the wallet, so nothing is kept as uncertain.
  expect(uncertainSendOf("0x4a1")).toBeUndefined();
});
