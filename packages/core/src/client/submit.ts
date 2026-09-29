import { extractErrorMessage } from "@bibliothecadao/provider/errors";
import {
  BlockTag,
  type AccountInterface,
  type AllowArray,
  type Call,
  type InvokeFunctionResponse,
  type UniversalDetails,
} from "starknet";

import { resolveGameTransactionResourceBounds } from "../account/transaction-resource-bounds";

type GameplaySubmitAccount = Pick<AccountInterface, "address" | "execute" | "getNonce">;
type RawExecute = (calls: AllowArray<Call>, details?: UniversalDetails) => Promise<InvokeFunctionResponse>;

interface ConfiguredGameplaySubmit {
  chainId: string;
  execute: RawExecute;
}

/**
 * Nonces are dispensed locally so a burst of actions signs and sends in
 * parallel: waiting for the previous send to return before allocating the
 * next nonce cost one node round trip per action. `nextNonce` is unknown
 * before the first read and after any failed send (the failed nonce may be
 * unconsumed); while it is unknown, every waiting action shares one
 * pre-confirmed read.
 */
interface AccountNonceDispenser {
  nextNonce?: bigint;
  nonceRead?: Promise<void>;
}

interface ExecuteGameplayAccountTransactionOptions {
  account: GameplaySubmitAccount;
  calls: AllowArray<Call>;
  chainId: string;
  details?: UniversalDetails;
}

interface GameplaySubmit extends ExecuteGameplayAccountTransactionOptions {
  dispenser: AccountNonceDispenser;
  execute: RawExecute;
}

const configuredGameplaySubmits = new WeakMap<object, ConfiguredGameplaySubmit>();
const accountNonceDispensers = new Map<string, AccountNonceDispenser>();

export function configureGameplayAccountSubmits<TAccount extends AccountInterface>(
  account: TAccount,
  chainId: string,
): TAccount {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) {
    assertConfiguredChain(account.address, configured.chainId, chainId);
    return account;
  }

  configuredGameplaySubmits.set(account, { chainId, execute: account.execute.bind(account) });
  account.execute = ((calls: AllowArray<Call>, details?: UniversalDetails) =>
    executeGameplayAccountTransaction({ account, calls, chainId, details })) as AccountInterface["execute"];
  return account;
}

export function executeGameplayAccountTransaction({
  account,
  calls,
  chainId,
  details,
}: ExecuteGameplayAccountTransactionOptions): Promise<InvokeFunctionResponse> {
  const configured = configuredGameplaySubmits.get(account);
  if (configured) assertConfiguredChain(account.address, configured.chainId, chainId);

  const execute = configured?.execute ?? account.execute.bind(account);
  const dispenser = resolveNonceDispenser(`${chainId}:${account.address.toLowerCase()}`);
  return submitWithLocalNonce({ account, calls, chainId, details, dispenser, execute });
}

function assertConfiguredChain(address: string, configuredChain: string, requestedChain: string): void {
  if (configuredChain !== requestedChain) {
    throw new Error(`Gameplay account ${address} is configured for ${configuredChain}, not ${requestedChain}`);
  }
}

function resolveNonceDispenser(key: string): AccountNonceDispenser {
  const dispenser = accountNonceDispensers.get(key) ?? {};
  accountNonceDispensers.set(key, dispenser);
  return dispenser;
}

async function submitWithLocalNonce(submit: GameplaySubmit): Promise<InvokeFunctionResponse> {
  try {
    return await submitOnce(submit);
  } catch (error) {
    if (isNonceRejection(error)) return submitOnce(submit);
    throw error;
  }
}

async function submitOnce({
  account,
  calls,
  details,
  dispenser,
  execute,
}: GameplaySubmit): Promise<InvokeFunctionResponse> {
  const nonce = await takeNonce(account, dispenser);
  try {
    return await execute(calls, { ...details, nonce, tip: 0, resourceBounds: resolveGameTransactionResourceBounds() });
  } catch (error) {
    dispenser.nextNonce = undefined;
    throw error;
  }
}

/**
 * A known nonce is taken synchronously, so concurrent callers receive
 * distinct, increasing nonces in call order. Waiters on a shared read re-enter
 * in registration order once it lands, which keeps that same ordering; if a
 * failed send marks the dispenser stale again in between, they read anew
 * instead of reusing anything.
 */
function takeNonce(account: GameplaySubmitAccount, dispenser: AccountNonceDispenser): Promise<bigint> {
  if (dispenser.nextNonce !== undefined) {
    const nonce = dispenser.nextNonce;
    dispenser.nextNonce = nonce + 1n;
    return Promise.resolve(nonce);
  }
  dispenser.nonceRead ??= readPreConfirmedNonce(account, dispenser);
  return dispenser.nonceRead.then(() => takeNonce(account, dispenser));
}

function readPreConfirmedNonce(account: GameplaySubmitAccount, dispenser: AccountNonceDispenser): Promise<void> {
  return account
    .getNonce(BlockTag.PRE_CONFIRMED)
    .then((nonce) => {
      dispenser.nextNonce = BigInt(nonce);
    })
    .finally(() => {
      dispenser.nonceRead = undefined;
    });
}

function isNonceRejection(error: unknown): boolean {
  const message = extractErrorMessage(error, "");
  return /nonce/i.test(message) && /(already|expected|got|invalid|mismatch|too high|too low)/i.test(message);
}
