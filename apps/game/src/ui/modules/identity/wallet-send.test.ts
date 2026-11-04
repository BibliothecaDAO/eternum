import { outsideExecution, typedData, type AccountInterface, type ProviderInterface, type TypedData } from "starknet";
import { expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("fetch", async () => new Response(null, { status: 401 })));
const passkey = vi.hoisted(() => ({ sign: vi.fn(async () => ["0x4", "0x9"]) }));
vi.mock("./passkey", () => ({ signWithPasskey: passkey.sign }));

import { identityClient } from "@/hooks/context/identity-session";
import { L2_CHAIN } from "@/runtime/l2-rpc";

import {
  prepareDefaultWalletSend,
  sendFromDefaultWallet,
  sendFromWallet,
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
  expect(outcome).toEqual({ kind: "refused", reason: "The network has not confirmed it yet" });
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
  await expect(sendFromDefaultWallet(WALLET, execution as unknown as TypedData, provider, signed)).resolves.toEqual({
    kind: "landed",
  });
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
