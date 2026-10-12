import { PublicError } from "./errors";
import { Account, CallData, ec, hash, RpcProvider, uint256, type Call } from "starknet";
import { ACCOUNT_CLASS, STRK, WEI } from "./settings";
import type { PrivateStore } from "./private-store";

export type Keys = Record<"deployer" | "relay" | "monitor" | "launcher" | "shardRelay", string>;
export const newKey = () => `0x${Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex")}`;
export function accountIdentity(key: string) {
  const publicKey = ec.starkCurve.getStarkKey(key);
  const calldata = CallData.compile([publicKey]);
  return { publicKey, calldata, address: hash.calculateContractAddressFromHash(publicKey, ACCOUNT_CLASS, calldata, 0) };
}
export function isMissing(error: unknown, code: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((error as { code?: number }).code === code || isMissing((error as { cause?: unknown }).cause, code))
  );
}
export { isContractRevert } from "../../packages/value-ledger/src/rpc";
export async function classAt(provider: RpcProvider, address: string) {
  try {
    const value = await provider.getClassHashAt(address, "latest");
    if (BigInt(value) <= 0n) throw new PublicError("Invalid class hash");
    return value;
  } catch (error) {
    if (isMissing(error, 20)) return undefined;
    throw error;
  }
}
export async function balance(provider: RpcProvider, token: string, address: string) {
  const row = await provider.callContract(
    { contractAddress: token, entrypoint: "balance_of", calldata: [address] },
    "latest",
  );
  if (row.length !== 2) throw new PublicError("Invalid token balance");
  return BigInt(row[0]!) + (BigInt(row[1]!) << 128n);
}
export async function confirm(provider: RpcProvider, transactionHash: string, output: (line: string) => void) {
  output("Waiting for transaction confirmation.");
  const receipt = await provider.waitForTransaction(transactionHash);
  if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED")
    throw new PublicError("Transaction did not succeed");
}
const TRANSACTION_HASH_NOT_FOUND = 29;
async function savedReceipt(account: Account, transactionHash: string) {
  try {
    return await account.waitForTransaction(transactionHash, { retries: 30, retryInterval: 1000 });
  } catch (error) {
    const timedOut = error instanceof Error && error.message.startsWith("waitForTransaction timed-out");
    if (!timedOut && !isMissing(error, TRANSACTION_HASH_NOT_FOUND)) throw error;
    // After the bounded wait, only an explicit missing receipt permits a same-nonce retry.
    try {
      const receipt = await account.getTransactionReceipt(transactionHash);
      if (!("finality_status" in receipt) || !["ACCEPTED_ON_L2", "ACCEPTED_ON_L1"].includes(receipt.finality_status))
        throw new PublicError("Saved transaction is still pending");
      return receipt;
    } catch (readError) {
      if (!isMissing(readError, TRANSACTION_HASH_NOT_FOUND)) throw readError;
      return undefined;
    }
  }
}
/** Saved state supplies a nonce and receipt identity, never executable calls. */
export async function send(
  account: Account,
  calls: Call[],
  store: PrivateStore,
  name: string,
  output: (line: string) => void,
) {
  const intentName = `transaction-${name}.json`;
  const previous = store.read<{ nonce: string; hash?: string }>(intentName);
  let nonce = previous?.nonce;
  if (previous?.hash) {
    output("Waiting for transaction confirmation.");
    const receipt = await savedReceipt(account, previous.hash);
    if (receipt) {
      if (!("execution_status" in receipt)) throw new PublicError("Saved transaction is still pending");
      if (receipt.execution_status === "SUCCEEDED") return;
      if (receipt.execution_status !== "REVERTED") throw new PublicError("Saved transaction is still pending");
      nonce = String(await account.getNonce());
    }
  }
  const intent: { nonce: string; calls: Call[]; hash?: string } = {
    nonce: nonce ?? String(await account.getNonce()),
    calls,
  };
  store.write(intentName, intent);
  const response = await account.execute(calls, { nonce: intent.nonce });
  intent.hash = response.transaction_hash;
  store.write(intentName, intent);
  await confirm(account, intent.hash, output);
}
export async function prepareAccounts(
  provider: RpcProvider,
  keys: Keys,
  store: PrivateStore,
  output: (line: string) => void,
  createAccount: (address: string, key: string) => Account = (address, signer) =>
    new Account({ provider, address, signer }),
) {
  if (BigInt(await provider.getChainId()) !== 0x534e5f4d41494en) throw new PublicError("Starknet mainnet required");
  await provider.getClassByHash(ACCOUNT_CLASS);
  const accounts = Object.fromEntries(
    (["deployer", "relay", "monitor"] as const).map((role) => {
      const identity = accountIdentity(keys[role]);
      return [role, createAccount(identity.address, keys[role])];
    }),
  ) as Record<"deployer" | "relay" | "monitor", Account>;
  if (
    !(await classAt(provider, accounts.deployer.address)) &&
    (await balance(provider, STRK, accounts.deployer.address)) < 250n * WEI
  ) {
    output(`Fund this address with about 250 STRK, then run the same command again: ${accounts.deployer.address}`);
    return undefined;
  }
  for (const role of ["deployer", "relay", "monitor"] as const) {
    const account = accounts[role];
    const deployed = await classAt(provider, account.address);
    if (deployed) {
      if (BigInt(deployed) !== BigInt(ACCOUNT_CLASS))
        throw new PublicError("Account class differs from the saved identity");
      const [key] = await provider.callContract(
        { contractAddress: account.address, entrypoint: "get_public_key", calldata: [] },
        "latest",
      );
      if (!key || BigInt(key) !== BigInt(accountIdentity(keys[role]).publicKey))
        throw new PublicError("Account key differs");
      continue;
    }
    if (role !== "deployer") {
      const desired = (role === "relay" ? 30n : 1n) * WEI;
      const held = await balance(provider, STRK, account.address);
      if (held < desired)
        await send(
          accounts.deployer,
          [
            {
              contractAddress: STRK,
              entrypoint: "transfer",
              calldata: CallData.compile([account.address, uint256.bnToUint256(desired - held)]),
            },
          ],
          store,
          `fund-${role}`,
          output,
        );
    }
    const identity = accountIdentity(keys[role]);
    const response = await account.deployAccount({
      classHash: ACCOUNT_CLASS,
      constructorCalldata: identity.calldata,
      addressSalt: identity.publicKey,
    });
    await confirm(provider, response.transaction_hash, output);
  }
  return accounts;
}
