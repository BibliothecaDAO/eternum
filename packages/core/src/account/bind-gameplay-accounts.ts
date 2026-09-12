import type { GameChain } from "@realms-world/chain";
import { type AccountInterface, type Call, CallData, num, type ProviderInterface } from "starknet";

import { resolveGameTransactionResourceBounds } from "./transaction-resource-bounds";

/** A deployed gameplay account and the owner it should be registered under; guests own themselves. */
interface GameplayAccountBinding {
  address: string;
  owner: string;
}

interface BindGameplayAccountsOptions {
  accounts: readonly GameplayAccountBinding[];
  /** The binding authority: the only account the registry lets call `bind`. */
  authority: AccountInterface;
  chain: GameChain;
  playerRegistryAddress: string;
  provider: ProviderInterface;
}

export interface GameplayAccountBindingResult {
  alreadyBound: number;
  bindingTransactionHashes: string[];
}

const BINDING_BATCH_SIZE = 24;
const BINDING_RECEIPT_POLL_MS = 50;

/**
 * Registers each account under its owner, skipping pairs the registry already holds. Idempotent: a rerun after a
 * partial failure binds only what is still missing, and a registry row that names a different account or owner is
 * a conflict, never silently overwritten.
 */
export async function bindGameplayAccounts(
  options: BindGameplayAccountsOptions,
): Promise<GameplayAccountBindingResult> {
  const calls: Call[] = [];
  let alreadyBound = 0;

  for (const account of options.accounts) {
    const registered = await readRegistryBinding(options.provider, options.playerRegistryAddress, account);
    if (registered === "bound") {
      alreadyBound += 1;
      continue;
    }
    calls.push(buildBindCall(options.playerRegistryAddress, account));
  }

  const bindingTransactionHashes: string[] = [];
  for (const batch of chunk(calls, BINDING_BATCH_SIZE)) {
    bindingTransactionHashes.push(await executeAndWait(options.authority, batch, options.chain));
  }
  return { alreadyBound, bindingTransactionHashes };
}

const readRegistryBinding = async (
  provider: ProviderInterface,
  registry: string,
  account: GameplayAccountBinding,
): Promise<"bound" | "unbound"> => {
  const [boundAccount, boundOwner] = await Promise.all([
    readRegistryAddress(provider, registry, "account_of", account.owner),
    readRegistryAddress(provider, registry, "owner_of", account.address),
  ]);
  if (sameAddress(boundAccount, account.address) && sameAddress(boundOwner, account.owner)) return "bound";
  if (boundAccount !== 0n || boundOwner !== 0n) {
    throw new Error(
      `PlayerRegistry binding conflict for owner ${account.owner}: account_of=${num.toHex(boundAccount)}, owner_of(${account.address})=${num.toHex(boundOwner)}`,
    );
  }
  return "unbound";
};

const readRegistryAddress = async (
  provider: ProviderInterface,
  registry: string,
  entrypoint: "account_of" | "owner_of",
  address: string,
): Promise<bigint> => {
  const result = await provider.callContract({ contractAddress: registry, entrypoint, calldata: [address] }, "latest");
  return BigInt(result[0] ?? "0x0");
};

const buildBindCall = (registry: string, account: GameplayAccountBinding): Call => ({
  contractAddress: registry,
  entrypoint: "bind",
  calldata: CallData.compile([account.owner, account.address]),
});

/** The authority has no Herald stream to wait on, so the bind is confirmed through the RPC receipt. */
const executeAndWait = async (authority: AccountInterface, calls: Call[], chain: GameChain): Promise<string> => {
  const { transaction_hash } = await authority.execute(calls, {
    resourceBounds: resolveGameTransactionResourceBounds(chain),
    tip: 0,
  });
  const receipt = await authority.waitForTransaction(transaction_hash, { retryInterval: BINDING_RECEIPT_POLL_MS });
  if (!receipt.isSuccess()) throw new Error(`Binding gameplay accounts failed for transaction ${transaction_hash}`);
  return transaction_hash;
};

const sameAddress = (left: bigint, right: string): boolean => left === BigInt(right);

const chunk = <T>(values: readonly T[], size: number): T[][] => {
  const batches: T[][] = [];
  for (let index = 0; index < values.length; index += size) batches.push(values.slice(index, index + size));
  return batches;
};
