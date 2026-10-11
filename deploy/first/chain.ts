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
export async function classAt(provider: RpcProvider, address: string) {
  try {
    const value = await provider.getClassHashAt(address, "latest");
    if (BigInt(value) <= 0n) throw new Error("Invalid class hash");
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
  if (row.length !== 2) throw new Error("Invalid token balance");
  return BigInt(row[0]!) + (BigInt(row[1]!) << 128n);
}
export async function confirm(provider: RpcProvider, transactionHash: string) {
  const receipt = await provider.waitForTransaction(transactionHash);
  if (!("execution_status" in receipt) || receipt.execution_status !== "SUCCEEDED")
    throw new Error("Transaction did not succeed");
}
/** Save the nonce before sending: a lost RPC reply cannot turn a retry into a second transfer. */
export async function send(account: Account, calls: Call[], store: PrivateStore, name: string) {
  const intentName = `transaction-${name}.json`;
  const intent = store.read<{ nonce: string; hash?: string; calls: Call[] }>(intentName) ?? {
    nonce: String(await account.getNonce()),
    calls,
  };
  if (JSON.stringify(intent.calls) !== JSON.stringify(calls))
    throw new Error("Pending transaction differs; inspect its receipt before changing inputs");
  if (intent.hash) {
    const receipt = await account.getTransactionReceipt(intent.hash);
    if ("execution_status" in receipt && receipt.execution_status === "REVERTED") {
      intent.nonce = String(await account.getNonce());
      delete intent.hash;
    }
  }
  store.write(intentName, intent);
  if (!intent.hash) {
    const response = await account.execute(calls, { nonce: intent.nonce });
    intent.hash = response.transaction_hash;
    store.write(intentName, intent);
  }
  await confirm(account, intent.hash);
}
export async function prepareAccounts(
  provider: RpcProvider,
  keys: Keys,
  store: PrivateStore,
  output: (line: string) => void,
  createAccount: (address: string, key: string) => Account = (address, signer) =>
    new Account({ provider, address, signer }),
) {
  if (BigInt(await provider.getChainId()) !== 0x534e5f4d41494en) throw new Error("Starknet mainnet required");
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
      if (BigInt(deployed) !== BigInt(ACCOUNT_CLASS)) throw new Error("Account class differs from the saved identity");
      const [key] = await provider.callContract(
        { contractAddress: account.address, entrypoint: "get_public_key", calldata: [] },
        "latest",
      );
      if (!key || BigInt(key) !== BigInt(accountIdentity(keys[role]).publicKey)) throw new Error("Account key differs");
      continue;
    }
    if (role !== "deployer") {
      const desired = (role === "relay" ? 30n : 1n) * WEI;
      const held = await balance(provider, STRK, account.address);
      const previous = store.read<{ calls: Call[] }>(`transaction-fund-${role}.json`);
      if (previous && held < desired) await send(accounts.deployer, previous.calls, store, `fund-${role}`);
      else if (held < desired)
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
        );
    }
    const identity = accountIdentity(keys[role]);
    const response = await account.deployAccount({
      classHash: ACCOUNT_CLASS,
      constructorCalldata: identity.calldata,
      addressSalt: identity.publicKey,
    });
    await confirm(provider, response.transaction_hash);
  }
  return accounts;
}
